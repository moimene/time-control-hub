// Offline cryptographic utilities for kiosk mode
// Uses Web Crypto API for HMAC-SHA256 signatures and AES-GCM encryption

const DEVICE_SECRET_KEY = 'kiosk_device_secret';
const ENCRYPTION_KEY_NAME = 'kiosk_encryption_key';

// Generate or retrieve device secret for HMAC signatures
export async function getDeviceSecret(): Promise<string> {
  let secret = localStorage.getItem(DEVICE_SECRET_KEY);
  if (!secret) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    secret = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_SECRET_KEY, secret);
  }
  return secret;
}

// Generate HMAC-SHA256 signature for event integrity
export async function generateSignature(data: string): Promise<string> {
  const secret = await getDeviceSecret();
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify HMAC-SHA256 signature
export async function verifySignature(data: string, signature: string): Promise<boolean> {
  const computed = await generateSignature(data);
  return computed === signature;
}

// Get or create AES-GCM encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (stored) {
    const keyData = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(ENCRYPTION_KEY_NAME, btoa(String.fromCharCode(...new Uint8Array(exported))));
  
  return key;
}

// Encrypt sensitive data (PIN/QR token) with AES-GCM
export async function encryptAuthData(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Decrypt sensitive data
export async function decryptAuthData(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}

// Create signature data string from event
export function createSignatureData(event: {
  id: string;
  employee_code: string;
  event_type: string;
  local_timestamp: string;
}): string {
  return `${event.id}|${event.employee_code}|${event.event_type}|${event.local_timestamp}`;
}
