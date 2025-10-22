// Local message storage using IndexedDB

export interface StoredMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  chat_id: string;
}

function openMessagesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatMessagesStore', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('messages')) {
        const objectStore = db.createObjectStore('messages', { keyPath: 'id' });
        objectStore.createIndex('chat_id', 'chat_id', { unique: false });
        objectStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

// Generate chat ID from two user IDs (always same order)
export function getChatId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

// Store a message locally
export async function storeMessageLocally(message: StoredMessage): Promise<void> {
  const db = await openMessagesDB();
  const tx = db.transaction('messages', 'readwrite');
  await tx.objectStore('messages').put(message);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get all messages for a chat
export async function getLocalMessages(chatId: string): Promise<StoredMessage[]> {
  const db = await openMessagesDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.objectStore('messages').index('chat_id');
  const request = index.getAll(chatId);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const messages = request.result;
      // Sort by created_at
      const sorted = messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear all local messages (for settings)
export async function clearLocalMessages(): Promise<void> {
  const db = await openMessagesDB();
  const tx = db.transaction('messages', 'readwrite');
  await tx.objectStore('messages').clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
