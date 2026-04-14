import { create } from 'zustand';

const API_KEY_STORAGE_KEY = 'ai-dnd-deepseek-api-key';

// 从 localStorage 读取 API key
const getStoredApiKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};

interface SettingsState {
  deepseekApiKey: string | null;
  moveSpeed: number;
  interactionRange: number;

  // Actions
  setApiKey: (key: string | null) => void;
  setMoveSpeed: (speed: number) => void;
  setInteractionRange: (range: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  deepseekApiKey: getStoredApiKey(),
  moveSpeed: 10,
  interactionRange: 50,

  setApiKey: (key) => {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    set({ deepseekApiKey: key });
  },
  setMoveSpeed: (speed) => set({ moveSpeed: speed }),
  setInteractionRange: (range) => set({ interactionRange: range }),
}));