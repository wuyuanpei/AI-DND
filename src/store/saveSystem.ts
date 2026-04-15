import { usePlayerStore } from './playerStore';
import { useWorldStore } from './worldStore';
import { useSettingsStore } from './settingsStore';

const SAVE_KEY = 'ai-dnd-save';

interface SaveData {
  player: ReturnType<typeof usePlayerStore.getState>;
  world: ReturnType<typeof useWorldStore.getState>;
  settings: ReturnType<typeof useSettingsStore.getState>;
  timestamp: number;
}

/**
 * 保存游戏到LocalStorage
 */
export function saveGame(): void {
  const saveData: SaveData = {
    player: usePlayerStore.getState(),
    world: useWorldStore.getState(),
    settings: useSettingsStore.getState(),
    timestamp: Date.now()
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

/**
 * 加载游戏存档
 */
export function loadGame(): boolean {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return false;

  try {
    const saveData: SaveData = JSON.parse(data);

    usePlayerStore.setState(saveData.player);
    useWorldStore.setState(saveData.world);
    useSettingsStore.setState(saveData.settings);

    return true;
  } catch (error) {
    console.error('加载存档失败:', error);
    return false;
  }
}

/**
 * 删除存档
 */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * 检查是否有存档
 */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * 获取存档时间
 */
export function getSaveTime(): number | null {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return null;

  try {
    const saveData: SaveData = JSON.parse(data);
    return saveData.timestamp;
  } catch {
    return null;
  }
}
