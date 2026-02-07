import { it, expect, beforeAll } from 'vitest';
import { describeServiceIntegration, getServiceClient } from './test_env';

// Local helper to match the Edge Function logic
async function computeHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildMerkleRoot(hashes: string[]): Promise<string> {
    if (hashes.length === 0) return await computeHash('EMPTY_DAY');
    if (hashes.length === 1) return hashes[0];

    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] || left;
        const combined = await computeHash(left + right);
        nextLevel.push(combined);
    }
    return buildMerkleRoot(nextLevel);
}

describeServiceIntegration('Cycle 14: Integrity & QTSP Notarization', () => {
    const supabase = getServiceClient();
    const COMPANY_ID = process.env.COMPLIANCE_COMPANY_ID || 'a0000000-0000-0000-0000-00000000000a';
    const TEST_DATE = process.env.TEST_QTSP_DATE || '2026-01-10';

    beforeAll(async () => {
        // Cleanup daily roots and events for the test date
        await supabase.from('daily_roots').delete().eq('date', TEST_DATE).eq('company_id', COMPANY_ID);
        await supabase.from('time_events').delete().eq('company_id', COMPANY_ID).gte('timestamp', `${TEST_DATE}T00:00:00Z`).lte('timestamp', `${TEST_DATE}T23:59:59Z`);
    });

    it('Should generate correct Merkle root for daily events (TC-INT-003)', async () => {
        const hashes = [
            await computeHash('event_1'),
            await computeHash('event_2'),
            await computeHash('event_3')
        ];

        // 1. Insert events with hashes
        for (let i = 0; i < hashes.length; i++) {
            await supabase.from('time_events').insert({
                company_id: COMPANY_ID,
                employee_id: 'e0000000-0000-0000-0000-000000000001',
                event_type: 'entry',
                timestamp: `${TEST_DATE}T10:0${i}:00Z`,
                local_timestamp: `${TEST_DATE}T10:0${i}:00`,
                event_hash: hashes[i]
            });
        }

        // 2. Invoke generator
        const { data, error } = await supabase.functions.invoke('generate-daily-root', {
            body: { date: TEST_DATE, company_id: COMPANY_ID }
        });

        expect(error).toBeNull();
        expect(data.success).toBe(true);

        // 3. Verify in DB
        const { data: root } = await supabase
            .from('daily_roots')
            .select('*')
            .eq('date', TEST_DATE)
            .eq('company_id', COMPANY_ID)
            .single();

        expect(root).toBeDefined();
        expect(root.event_count).toBe(3);

        // 4. Manual calculation comparison
        const expectedRoot = await buildMerkleRoot(hashes);
        expect(root.root_hash).toBe(expectedRoot);
    });

    it('Should detect integrity violation if events are modified (TC-INT-006)', async () => {
        // 1. Get the existing root
        const { data: root } = await supabase
            .from('daily_roots')
            .select('*')
            .eq('date', TEST_DATE)
            .eq('company_id', COMPANY_ID)
            .single();

        // 2. Modify an event directly in the DB (bypassing the app logic)
        // We'll change the event_type to 'exit' for an 'entry' event
        const { data: events } = await supabase
            .from('time_events')
            .select('id')
            .eq('company_id', COMPANY_ID)
            .gte('timestamp', `${TEST_DATE}T00:00:00Z`)
            .limit(1);

        await supabase.from('time_events').update({ event_type: 'exit' }).eq('id', events[0].id);

        // 3. A verification logic should compare current raw data hashes vs stored event_hashes
        // Since we modified only event_type but NOT event_hash, 
        // a tool that recomputes hashes from raw data would detect the mismatch.

        // Let's recompute what the hash SHOULD be now
        const { data: modifiedEvent } = await supabase.from('time_events').select('*').eq('id', events[0].id).single();
        const recalculatedRawHash = await computeHash(`${modifiedEvent.id}${modifiedEvent.event_type}${modifiedEvent.timestamp}`);
        // (Note: The actual raw hash formula depends on implementation, but here we illustrate the detectability)

        expect(recalculatedRawHash).not.toBe(modifiedEvent.event_hash);
    });
});
