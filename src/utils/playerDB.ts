import type { DialogueMessage } from '../types';

const DB_NAME = 'ai-dnd-player';
const DB_VERSION = 4;
const PLAYER_STORE = 'playerData';
const LOGS_STORE = 'gameLogs';
const DIALOGUE_STORE = 'dialogueHistory';
const SHOP_STORE = 'shopWeapons';

// Armor shop store
const SHOP_ARMOR_STORE = 'shopArmors';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAYER_STORE)) {
        db.createObjectStore(PLAYER_STORE);
      }
      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE);
      }
      if (!db.objectStoreNames.contains(DIALOGUE_STORE)) {
        db.createObjectStore(DIALOGUE_STORE);
      }
      if (!db.objectStoreNames.contains(SHOP_STORE)) {
        db.createObjectStore(SHOP_STORE);
      }
      if (!db.objectStoreNames.contains(SHOP_ARMOR_STORE)) {
        db.createObjectStore(SHOP_ARMOR_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PlayerJson {
  name: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
}

export function buildPlayerMd(text: PlayerJson): string {
  return `---
name: "${text.name}"
gender: "${text.gender ?? ''}"
appearance: "${text.appearance ?? ''}"
personality: "${text.personality ?? ''}"
backstory: "${text.backstory ?? ''}"
---
`;
}

export async function savePlayerJson(text: PlayerJson): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readwrite');
    tx.objectStore(PLAYER_STORE).put(text, 'playerJson');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPlayerJson(): Promise<PlayerJson | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readonly');
    const request = tx.objectStore(PLAYER_STORE).get('playerJson');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAvatar(blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readwrite');
    tx.objectStore(PLAYER_STORE).put(blob, 'avatar');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAvatar(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readonly');
    const request = tx.objectStore(PLAYER_STORE).get('avatar');
    request.onsuccess = () => {
      const blob: Blob | undefined = request.result;
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearPlayerData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYER_STORE, DIALOGUE_STORE], 'readwrite');
    tx.objectStore(PLAYER_STORE).clear();
    tx.objectStore(DIALOGUE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDMPhase(phase: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readwrite');
    tx.objectStore(PLAYER_STORE).put(phase, 'dmPhase');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDMPhase(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_STORE, 'readonly');
    const request = tx.objectStore(PLAYER_STORE).get('dmPhase');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDialogueHistory(key: string, messages: DialogueMessage[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIALOGUE_STORE, 'readwrite');
    tx.objectStore(DIALOGUE_STORE).put(messages, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDialogueHistory(key: string): Promise<DialogueMessage[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIALOGUE_STORE, 'readonly');
    const request = tx.objectStore(DIALOGUE_STORE).get(key);
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearDialogueHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIALOGUE_STORE, 'readwrite');
    tx.objectStore(DIALOGUE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Game logs
export interface GameLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'api' | 'system' | 'ui' | 'combat' | 'world' | 'memory';
  message: string;
  details?: string;
}

export async function saveGameLogs(logs: GameLog[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOGS_STORE, 'readwrite');
    tx.objectStore(LOGS_STORE).put(logs, 'logs');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadGameLogs(): Promise<GameLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOGS_STORE, 'readonly');
    const request = tx.objectStore(LOGS_STORE).get('logs');
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearGameLogs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOGS_STORE, 'readwrite');
    tx.objectStore(LOGS_STORE).delete('logs');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Shop weapons persistence (store IDs only, full data from weapons.json)
export async function saveShopWeaponIds(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_STORE, 'readwrite');
    tx.objectStore(SHOP_STORE).put(ids, 'weaponIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadShopWeaponIds(): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_STORE, 'readonly');
    const request = tx.objectStore(SHOP_STORE).get('weaponIds');
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearShopWeapons(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_STORE, 'readwrite');
    tx.objectStore(SHOP_STORE).delete('weaponIds');
    tx.objectStore(SHOP_STORE).delete('purchasedWeaponIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Purchased weapon IDs within current shop
export async function savePurchasedWeaponIds(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_STORE, 'readwrite');
    tx.objectStore(SHOP_STORE).put(ids, 'purchasedWeaponIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPurchasedWeaponIds(): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_STORE, 'readonly');
    const request = tx.objectStore(SHOP_STORE).get('purchasedWeaponIds');
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Shop armor IDs persistence
export async function saveShopArmorIds(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_ARMOR_STORE, 'readwrite');
    tx.objectStore(SHOP_ARMOR_STORE).put(ids, 'armorIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadShopArmorIds(): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_ARMOR_STORE, 'readonly');
    const request = tx.objectStore(SHOP_ARMOR_STORE).get('armorIds');
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function savePurchasedArmorIds(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_ARMOR_STORE, 'readwrite');
    tx.objectStore(SHOP_ARMOR_STORE).put(ids, 'purchasedArmorIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPurchasedArmorIds(): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHOP_ARMOR_STORE, 'readonly');
    const request = tx.objectStore(SHOP_ARMOR_STORE).get('purchasedArmorIds');
    request.onsuccess = () => {
      const result = request.result;
      resolve(Array.isArray(result) ? result : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearShopData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SHOP_STORE, SHOP_ARMOR_STORE], 'readwrite');
    tx.objectStore(SHOP_STORE).delete('weaponIds');
    tx.objectStore(SHOP_STORE).delete('purchasedWeaponIds');
    tx.objectStore(SHOP_ARMOR_STORE).delete('armorIds');
    tx.objectStore(SHOP_ARMOR_STORE).delete('purchasedArmorIds');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Combat history helpers
export function generateCombatHistoryKey(): string {
  return `combat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function saveCombatState(key: string, messages: DialogueMessage[]): Promise<void> {
  return saveDialogueHistory(key, messages);
}

export async function loadCombatState(key: string): Promise<DialogueMessage[] | null> {
  return loadDialogueHistory(key);
}

export async function clearAllCombatStates(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIALOGUE_STORE, 'readwrite');
    const store = tx.objectStore(DIALOGUE_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const keys = request.result as string[];
      for (const key of keys) {
        if (typeof key === 'string' && key.startsWith('combat_')) {
          store.delete(key);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
