import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error';
export type GameLogCategory = 'api' | 'system' | 'ui' | 'combat' | 'world' | 'memory';

export interface GameLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: GameLogCategory;
  message: string;
  details?: string; // 额外的 JSON 格式详情
}

const LOG_STORAGE_KEY = 'ai-dnd-game-logs';
const MAX_LOGS = 1000; // 最多保留 1000 条日志

const getStoredLogs = (): GameLog[] => {
  try {
    const data = localStorage.getItem(LOG_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

interface LogState {
  logs: GameLog[];

  addLog: (log: Omit<GameLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  getLogsByCategory: (category: GameLogCategory) => GameLog[];
}

const initialLogs = getStoredLogs();

export const useLogStore = create<LogState>((set, get) => ({
  logs: initialLogs,

  addLog: ({ level, category, message, details }) => {
    set((state) => {
      const newLog: GameLog = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        level,
        category,
        message,
        details,
      };
      const newLogs = [newLog, ...state.logs].slice(0, MAX_LOGS);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(newLogs));
      return { logs: newLogs };
    });
  },

  clearLogs: () => {
    localStorage.removeItem(LOG_STORAGE_KEY);
    set({ logs: [] });
  },

  getLogsByCategory: (category) => {
    return get().logs.filter((log) => log.category === category);
  },
}));

// 便捷函数：不依赖 React 组件即可记录日志
export const logApiCall = (
  message: string,
  details?: {
    systemPrompt?: string;
    userMessage?: string;
    config?: Record<string, unknown>;
    response?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    error?: string;
    historyCount?: number;
    messages?: unknown;
  }
) => {
  useLogStore.getState().addLog({
    level: details?.error ? 'error' : 'info',
    category: 'api',
    message,
    details: details ? JSON.stringify(details, null, 2) : undefined,
  });
};

export const logApiError = (message: string, details?: string) => {
  useLogStore.getState().addLog({
    level: 'error',
    category: 'api',
    message,
    details,
  });
};

export const logSystem = (message: string, details?: string) => {
  useLogStore.getState().addLog({
    level: 'info',
    category: 'system',
    message,
    details,
  });
};

export const logError = (message: string, details?: string) => {
  useLogStore.getState().addLog({
    level: 'error',
    category: 'system',
    message,
    details,
  });
};

export const logMemory = (message: string, details?: string) => {
  useLogStore.getState().addLog({
    level: 'info',
    category: 'memory',
    message,
    details,
  });
};
