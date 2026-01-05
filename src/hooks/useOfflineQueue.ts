import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateSignature, 
  encryptAuthData, 
  decryptAuthData, 
  createSignatureData 
} from '@/lib/offlineCrypto';

const DB_NAME = 'kiosk_offline_db';
const STORE_NAME = 'offline_clock_events';
const DB_VERSION = 1;

export interface OfflineClockEvent {
  id: string;
  employee_code: string;
  event_type: 'entry' | 'exit';
  local_timestamp: string;
  signature: string;
  auth_method: 'pin' | 'qr';
  auth_data: string; // Encrypted PIN or QR token
  created_at: string;
  synced: boolean;
  sync_attempts: number;
  override_reason?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

export function useOfflineQueue() {
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const updateQueueSize = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('synced');
      const request = index.count(IDBKeyRange.only(false));
      
      request.onsuccess = () => {
        setQueueSize(request.result);
      };
    } catch (error) {
      console.error('Error getting queue size:', error);
    }
  }, []);

  useEffect(() => {
    updateQueueSize();
  }, [updateQueueSize]);

  const addToQueue = useCallback(async (
    employeeCode: string,
    eventType: 'entry' | 'exit',
    authMethod: 'pin' | 'qr',
    authValue: string,
    overrideReason?: string
  ): Promise<OfflineClockEvent> => {
    const id = crypto.randomUUID();
    const localTimestamp = new Date().toISOString();
    
    // Create signature for integrity
    const signatureData = createSignatureData({
      id,
      employee_code: employeeCode,
      event_type: eventType,
      local_timestamp: localTimestamp,
    });
    const signature = await generateSignature(signatureData);
    
    // Encrypt auth data
    const encryptedAuth = await encryptAuthData(authValue);
    
    const event: OfflineClockEvent = {
      id,
      employee_code: employeeCode,
      event_type: eventType,
      local_timestamp: localTimestamp,
      signature,
      auth_method: authMethod,
      auth_data: encryptedAuth,
      created_at: localTimestamp,
      synced: false,
      sync_attempts: 0,
      override_reason: overrideReason,
    };
    
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(event);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    await updateQueueSize();
    return event;
  }, [updateQueueSize]);

  const getPendingEvents = useCallback(async (): Promise<OfflineClockEvent[]> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const markAsSynced = useCallback(async (id: string) => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const event = await new Promise<OfflineClockEvent>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (event) {
      event.synced = true;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    await updateQueueSize();
  }, [updateQueueSize]);

  const incrementSyncAttempts = useCallback(async (id: string) => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const event = await new Promise<OfflineClockEvent>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (event) {
      event.sync_attempts += 1;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }, []);

  const syncQueue = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isSyncing) return { synced: 0, failed: 0 };
    
    setIsSyncing(true);
    let synced = 0;
    let failed = 0;
    
    try {
      const pendingEvents = await getPendingEvents();
      
      if (pendingEvents.length === 0) {
        setLastSync(new Date());
        return { synced: 0, failed: 0 };
      }
      
      // Prepare events for sync (decrypt auth data)
      const eventsToSync = await Promise.all(
        pendingEvents.map(async (event) => ({
          offline_uuid: event.id,
          employee_code: event.employee_code,
          event_type: event.event_type,
          local_timestamp: event.local_timestamp,
          signature: event.signature,
          auth_method: event.auth_method,
          auth_data: await decryptAuthData(event.auth_data),
          override_reason: event.override_reason,
        }))
      );
      
      const { data, error } = await supabase.functions.invoke('kiosk-clock', {
        body: {
          action: 'sync_offline',
          events: eventsToSync,
        },
      });
      
      if (error) {
        console.error('Sync error:', error);
        failed = pendingEvents.length;
      } else if (data?.results) {
        for (const result of data.results) {
          if (result.success) {
            await markAsSynced(result.offline_uuid);
            synced++;
          } else {
            await incrementSyncAttempts(result.offline_uuid);
            failed++;
          }
        }
      }
      
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync queue error:', error);
      failed = -1;
    } finally {
      setIsSyncing(false);
      await updateQueueSize();
    }
    
    return { synced, failed };
  }, [isSyncing, getPendingEvents, markAsSynced, incrementSyncAttempts, updateQueueSize]);

  const clearSyncedEvents = useCallback(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    
    const syncedEvents = await new Promise<OfflineClockEvent[]>((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(true));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    for (const event of syncedEvents) {
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(event.id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }, []);

  return {
    queueSize,
    isSyncing,
    lastSync,
    addToQueue,
    syncQueue,
    clearSyncedEvents,
    getPendingEvents,
  };
}
