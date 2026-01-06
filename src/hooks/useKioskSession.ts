import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'kiosk_device_token';
const STORAGE_BACKUP_KEY = 'kiosk_device_token_backup';
const DB_NAME = 'KioskDB';
const DB_STORE = 'sessions';

interface KioskSession {
  deviceToken: string;
  sessionId: string;
  companyId: string;
  companyName: string;
  employeeCodePrefix: string;
  terminalId: string | null;
  terminalName: string | null;
  terminalLocation: string | null;
}

interface UseKioskSessionReturn {
  session: KioskSession | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  login: (email: string, password: string, deviceName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setTerminal: (terminalId: string) => Promise<boolean>;
  clearSession: () => void;
}

// IndexedDB helpers for maximum persistence
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
  });
}

async function saveToIndexedDB(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put({ key, value });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[useKioskSession] IndexedDB save failed:', e);
  }
}

async function getFromIndexedDB(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const request = store.get(key);
    const result = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result?.value || null;
  } catch (e) {
    console.warn('[useKioskSession] IndexedDB read failed:', e);
    return null;
  }
}

async function removeFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.delete(key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[useKioskSession] IndexedDB delete failed:', e);
  }
}

// Multi-storage save/load for maximum persistence
function saveToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (e) {
    console.warn('[useKioskSession] localStorage save failed:', e);
  }
  try {
    sessionStorage.setItem(STORAGE_BACKUP_KEY, token);
  } catch (e) {
    console.warn('[useKioskSession] sessionStorage save failed:', e);
  }
  saveToIndexedDB(STORAGE_KEY, token);
}

async function loadToken(): Promise<string | null> {
  // Try localStorage first
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    if (token) return token;
  } catch (e) {
    console.warn('[useKioskSession] localStorage read failed:', e);
  }

  // Try sessionStorage backup
  try {
    const token = sessionStorage.getItem(STORAGE_BACKUP_KEY);
    if (token) {
      // Restore to localStorage
      try { localStorage.setItem(STORAGE_KEY, token); } catch {}
      return token;
    }
  } catch (e) {
    console.warn('[useKioskSession] sessionStorage read failed:', e);
  }

  // Try IndexedDB as last resort
  const token = await getFromIndexedDB(STORAGE_KEY);
  if (token) {
    // Restore to localStorage and sessionStorage
    try { localStorage.setItem(STORAGE_KEY, token); } catch {}
    try { sessionStorage.setItem(STORAGE_BACKUP_KEY, token); } catch {}
  }
  return token;
}

function clearToken(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(STORAGE_BACKUP_KEY); } catch {}
  removeFromIndexedDB(STORAGE_KEY);
  // Also clear old terminal selection
  try { localStorage.removeItem('kiosk_terminal_id'); } catch {}
}

export function useKioskSession(): UseKioskSessionReturn {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate session on mount and periodically
  const validateSession = useCallback(async (token: string): Promise<KioskSession | null> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('kiosk-auth', {
        body: { action: 'validate', deviceToken: token },
      });

      if (invokeError) throw invokeError;

      if (data.valid) {
        return {
          deviceToken: token,
          sessionId: data.sessionId,
          companyId: data.companyId,
          companyName: data.companyName,
          employeeCodePrefix: data.employeeCodePrefix,
          terminalId: data.terminalId,
          terminalName: data.terminalName,
          terminalLocation: data.terminalLocation,
        };
      }
      return null;
    } catch (e) {
      console.error('[useKioskSession] Validation error:', e);
      return null;
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const token = await loadToken();
        if (token) {
          setIsValidating(true);
          const validSession = await validateSession(token);
          if (validSession) {
            setSession(validSession);
          } else {
            clearToken();
          }
          setIsValidating(false);
        }
      } catch (e) {
        console.error('[useKioskSession] Init error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [validateSession]);

  // Periodic validation (every hour)
  useEffect(() => {
    if (!session?.deviceToken) return;

    const interval = setInterval(async () => {
      const validSession = await validateSession(session.deviceToken);
      if (!validSession) {
        setSession(null);
        clearToken();
        setError('Sesión expirada o revocada');
      }
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [session?.deviceToken, validateSession]);

  const login = useCallback(async (email: string, password: string, deviceName?: string): Promise<boolean> => {
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('kiosk-auth', {
        body: { action: 'login', email, password, deviceName },
      });

      if (invokeError) throw invokeError;

      if (data.error) {
        setError(data.error);
        return false;
      }

      if (data.success && data.deviceToken) {
        saveToken(data.deviceToken);
        setSession({
          deviceToken: data.deviceToken,
          sessionId: data.sessionId,
          companyId: data.companyId,
          companyName: data.companyName,
          employeeCodePrefix: data.employeeCodePrefix,
          terminalId: null,
          terminalName: null,
          terminalLocation: null,
        });
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('[useKioskSession] Login error:', e);
      setError(e.message || 'Error de conexión');
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (session?.deviceToken) {
      try {
        await supabase.functions.invoke('kiosk-auth', {
          body: { action: 'logout', deviceToken: session.deviceToken },
        });
      } catch (e) {
        console.error('[useKioskSession] Logout error:', e);
      }
    }
    clearToken();
    setSession(null);
    setError(null);
  }, [session?.deviceToken]);

  const setTerminal = useCallback(async (terminalId: string): Promise<boolean> => {
    if (!session?.deviceToken) return false;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('kiosk-auth', {
        body: { action: 'set_terminal', deviceToken: session.deviceToken, terminalId },
      });

      if (invokeError) throw invokeError;

      if (data.error) {
        setError(data.error);
        return false;
      }

      if (data.success) {
        setSession(prev => prev ? {
          ...prev,
          terminalId: data.terminalId,
          terminalName: data.terminalName,
          terminalLocation: data.terminalLocation,
        } : null);
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('[useKioskSession] Set terminal error:', e);
      setError(e.message || 'Error al vincular terminal');
      return false;
    }
  }, [session?.deviceToken]);

  const clearSession = useCallback(() => {
    clearToken();
    setSession(null);
    setError(null);
  }, []);

  return {
    session,
    isLoading,
    isValidating,
    error,
    login,
    logout,
    setTerminal,
    clearSession,
  };
}
