import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function getClient(email: string, password: string) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
}

describe('Cycle 6: Correcciones + Workflow + Auditoría', () => {

    it('Employee should be able to request a correction', async () => {
        const email = 'juan.martinez@elrincon.com';
        const client = await getClient(email, 'emp123');

        // 1. Get employee and an existing event
        const { data: employee } = await client.from('employees').select('id').single();
        const { data: event } = await client.from('time_events').select('id, event_type').limit(1).single();

        expect(employee).toBeDefined();
        expect(event).toBeDefined();

        // 2. Create correction request
        const { data: request, error: reqError } = await client.from('correction_requests').insert({
            employee_id: employee!.id,
            original_event_id: event!.id,
            requested_event_type: event!.event_type,
            requested_timestamp: new Date().toISOString(),
            reason: 'Olvidé fichar a tiempo',
            status: 'pending'
        }).select().single();

        if (reqError) console.error('Error creating request:', reqError);
        expect(reqError).toBeNull();
        expect(request.status).toBe('pending');
    });

    it('Responsible should be able to approve a correction', async () => {
        const respEmail = 'responsable@elrincon.com';
        const client = await getClient(respEmail, 'resp123');

        // 1. Find a pending request
        const { data: request } = await client.from('correction_requests')
            .select('*')
            .eq('status', 'pending')
            .limit(1)
            .single();

        expect(request).toBeDefined();

        // 2. Approve request
        const { data: updatedRequest, error: updateError } = await client.from('correction_requests')
            .update({
                status: 'approved',
                review_notes: 'Aprobado por el responsable',
                reviewed_at: new Date().toISOString()
            })
            .eq('id', request.id)
            .select()
            .single();

        expect(updateError).toBeNull();
        expect(updatedRequest.status).toBe('approved');

        // 3. Verify original event is still there (Inmutability)
        const { data: originalEvent } = await client.from('time_events')
            .select('id')
            .eq('id', request.original_event_id)
            .single();

        expect(originalEvent).toBeDefined();
    });
});
