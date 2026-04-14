import { create } from 'zustand';
import type { TokenUsage } from '../services/deepseek';

const API_KEY_STORAGE_KEY = 'ai-dnd-deepseek-api-key';
const STATS_STORAGE_KEY = 'ai-dnd-api-stats';

// 从 localStorage 读取 API key
const getStoredApiKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};

// 从 localStorage 读取统计数据
const getStoredStats = () => {
  try {
    const data = localStorage.getItem(STATS_STORAGE_KEY);
    return data ? JSON.parse(data) : { apiCallCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0 };
  } catch {
    return { apiCallCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0 };
  }
};

interface SettingsState {
  deepseekApiKey: string | null;
  moveSpeed: number;
  interactionRange: number;
  apiCallCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;

  setApiKey: (key: string | null) => void;
  setMoveSpeed: (speed: number) => void;
  setInteractionRange: (range: number) => void;
  addApiUsage: (usage: TokenUsage) => void;
  resetStats: () => void;
}

const initialStats = getStoredStats();

export const useSettingsStore = create<SettingsState>((set) => ({
  deepseekApiKey: getStoredApiKey(),
  moveSpeed: 10,
  interactionRange: 50,
  apiCallCount: initialStats.apiCallCount,
  totalPromptTokens: initialStats.totalPromptTokens,
  totalCompletionTokens: initialStats.totalCompletionTokens,
  totalTokens: initialStats.totalTokens,

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
  addApiUsage: (usage) => {
    set((state) => {
      const newStats = {
        apiCallCount: state.apiCallCount + 1,
        totalPromptTokens: state.totalPromptTokens + usage.promptTokens,
        totalCompletionTokens: state.totalCompletionTokens + usage.completionTokens,
        totalTokens: state.totalTokens + usage.totalTokens
      };
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(newStats));
      return newStats;
    });
  },
  resetStats: () => {
    const emptyStats = { apiCallCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0 };
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(emptyStats));
    set(emptyStats);
  }
}));
