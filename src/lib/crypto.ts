// End-to-End Encryption using Web Crypto API
// Uses ECDH for key exchange and AES-GCM for message encryption

const CRYPTO_KEY_PAIR_STORAGE_KEY = 'chat_crypto_keypair';
const SHARED_KEYS_STORAGE_KEY = 'chat_shared_keys';

export interface KeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

// Generate a new ECDH key pair for the user
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-384',
    },
    true,
    ['deriveKey']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

// Store key pair in IndexedDB (more secure than localStorage)
export async function storeKeyPair(keyPair: KeyPair): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('keys', 'readwrite');
  await tx.objectStore('keys').put(keyPair, CRYPTO_KEY_PAIR_STORAGE_KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Retrieve key pair from IndexedDB
export async function getKeyPair(): Promise<KeyPair | null> {
  const db = await openDB();
  const request = db.transaction('keys').objectStore('keys').get(CRYPTO_KEY_PAIR_STORAGE_KEY);
  return new Promise<KeyPair | null>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Derive a shared secret key from user's private key and peer's public key
export async function deriveSharedKey(
  privateKeyJwk: JsonWebKey,
  publicKeyJwk: JsonWebKey
): Promise<CryptoKey> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDH', namedCurve: 'P-384' },
    false,
    ['deriveKey']
  );

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-384' },
    false,
    []
  );

  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a message using AES-GCM
export async function encryptMessage(message: string, sharedKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    data
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

// Decrypt a message using AES-GCM
export async function decryptMessage(encryptedMessage: string, sharedKey: CryptoKey): Promise<string> {
  try {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
}

// IndexedDB helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatCryptoStore', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
      if (!db.objectStoreNames.contains('sharedKeys')) {
        db.createObjectStore('sharedKeys');
      }
    };
  });
}

// Cache shared key for a user
export async function cacheSharedKey(userId: string, sharedKey: CryptoKey): Promise<void> {
  const exported = await crypto.subtle.exportKey('jwk', sharedKey);
  const db = await openDB();
  const tx = db.transaction('sharedKeys', 'readwrite');
  await tx.objectStore('sharedKeys').put(exported, userId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get cached shared key for a user
export async function getCachedSharedKey(userId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  const request = db.transaction('sharedKeys').objectStore('sharedKeys').get(userId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = async () => {
      const exported = request.result;
      if (!exported) {
        resolve(null);
        return;
      }

      try {
        const key = await crypto.subtle.importKey(
          'jwk',
          exported as JsonWebKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        resolve(key);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
