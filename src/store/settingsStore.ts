import { create } from 'zustand';
import type { TokenUsage } from '../services/qwen';
import { logSystem } from './logStore';

const QWEN_API_KEY_STORAGE_KEY = 'ai-dnd-qwen-api-key';
const DEEPSEEK_API_KEY_STORAGE_KEY = 'ai-dnd-deepseek-api-key';
const PROVIDER_STORAGE_KEY = 'ai-dnd-provider';
const QWEN_MODEL_STORAGE_KEY = 'ai-dnd-qwen-model';
const DEEPSEEK_MODEL_STORAGE_KEY = 'ai-dnd-deepseek-model';

const IMAGE_API_KEY_STORAGE_KEY = 'ai-dnd-image-api-key';
const IMAGE_MODEL_STORAGE_KEY = 'ai-dnd-image-model';
const IMAGE_API_URL_STORAGE_KEY = 'ai-dnd-image-api-url';

export type Provider = 'qwen' | 'deepseek';

// 从 localStorage 读取配置
const getStoredApiKey = (provider: Provider): string | null => {
  try {
    const key = provider === 'qwen' ? QWEN_API_KEY_STORAGE_KEY : DEEPSEEK_API_KEY_STORAGE_KEY;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const getStoredProvider = (): Provider => {
  try {
    return (localStorage.getItem(PROVIDER_STORAGE_KEY) as Provider) || 'qwen';
  } catch {
    return 'qwen';
  }
};

const getStoredModel = (provider: Provider): string => {
  try {
    const key = provider === 'qwen' ? QWEN_MODEL_STORAGE_KEY : DEEPSEEK_MODEL_STORAGE_KEY;
    return localStorage.getItem(key) || (provider === 'qwen' ? 'qwen3.5-flash' : 'deepseek-chat');
  } catch {
    return provider === 'qwen' ? 'qwen3.5-flash' : 'deepseek-chat';
  }
};

const getStoredImageApiKey = (): string | null => {
  try {
    return localStorage.getItem(IMAGE_API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};

const getStoredImageModel = (): string => {
  try {
    return localStorage.getItem(IMAGE_MODEL_STORAGE_KEY) || 'wanx2.1-t2i-plus';
  } catch {
    return 'wanx2.1-t2i-plus';
  }
};

const getStoredImageApiUrl = (): string => {
  try {
    return localStorage.getItem(IMAGE_API_URL_STORAGE_KEY) || 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations';
  } catch {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations';
  }
};

const PROVIDER_API_URLS: Record<Provider, string> = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
};

interface SettingsState {
  provider: Provider;
  qwenApiKey: string | null;
  deepseekApiKey: string | null;
  qwenModel: string;
  deepseekModel: string;
  apiCallCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  // 图片生成配置
  imageApiKey: string | null;
  imageModel: string;
  imageApiUrl: string;

  setProvider: (provider: Provider) => void;
  setApiKey: (provider: Provider, key: string | null) => void;
  setModel: (provider: Provider, model: string) => void;
  setImageConfig: (config: { apiKey?: string; model?: string; apiUrl?: string }) => void;
  addApiUsage: (usage: TokenUsage) => void;
  resetStats: () => void;
  // 获取当前 provider 的配置
  getCurrentApiKey: () => string | null;
  getCurrentModel: () => string;
  getCurrentApiUrl: () => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  provider: getStoredProvider(),
  qwenApiKey: getStoredApiKey('qwen'),
  deepseekApiKey: getStoredApiKey('deepseek'),
  qwenModel: getStoredModel('qwen'),
  deepseekModel: getStoredModel('deepseek'),
  apiCallCount: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  imageApiKey: getStoredImageApiKey(),
  imageModel: getStoredImageModel(),
  imageApiUrl: getStoredImageApiUrl(),

  setProvider: (provider) => {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    set({ provider });
    logSystem(`服务商切换: ${provider}`);
  },
  setApiKey: (provider, key) => {
    const storageKey = provider === 'qwen' ? QWEN_API_KEY_STORAGE_KEY : DEEPSEEK_API_KEY_STORAGE_KEY;
    if (key) {
      localStorage.setItem(storageKey, key);
    } else {
      localStorage.removeItem(storageKey);
    }
    set(provider === 'qwen' ? { qwenApiKey: key } : { deepseekApiKey: key });
  },
  setModel: (provider, model) => {
    const storageKey = provider === 'qwen' ? QWEN_MODEL_STORAGE_KEY : DEEPSEEK_MODEL_STORAGE_KEY;
    localStorage.setItem(storageKey, model);
    const state = get();
    const oldModel = provider === 'qwen' ? state.qwenModel : state.deepseekModel;
    set(provider === 'qwen' ? { qwenModel: model } : { deepseekModel: model });
    logSystem(`模型切换 (${provider}): ${oldModel || '无'} → ${model}`);
  },
  setImageConfig: (config) => {
    const updates: Partial<SettingsState> = {};
    if (config.apiKey !== undefined) {
      if (config.apiKey) {
        localStorage.setItem(IMAGE_API_KEY_STORAGE_KEY, config.apiKey);
      } else {
        localStorage.removeItem(IMAGE_API_KEY_STORAGE_KEY);
      }
      updates.imageApiKey = config.apiKey || null;
    }
    if (config.model !== undefined) {
      localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, config.model);
      updates.imageModel = config.model;
    }
    if (config.apiUrl !== undefined) {
      localStorage.setItem(IMAGE_API_URL_STORAGE_KEY, config.apiUrl);
      updates.imageApiUrl = config.apiUrl;
    }
    set(updates);
    logSystem('图片模型配置更新', JSON.stringify(updates));
  },
  addApiUsage: (usage) => {
    set((state) => ({
      apiCallCount: state.apiCallCount + 1,
      totalPromptTokens: state.totalPromptTokens + usage.promptTokens,
      totalCompletionTokens: state.totalCompletionTokens + usage.completionTokens,
      totalTokens: state.totalTokens + usage.totalTokens
    }));
  },
  resetStats: () => {
    set({ apiCallCount: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0 });
  },
  getCurrentApiKey: () => {
    const state = get();
    return state.provider === 'qwen' ? state.qwenApiKey : state.deepseekApiKey;
  },
  getCurrentModel: () => {
    const state = get();
    return state.provider === 'qwen' ? state.qwenModel : state.deepseekModel;
  },
  getCurrentApiUrl: () => {
    const state = get();
    return PROVIDER_API_URLS[state.provider];
  },
}));
