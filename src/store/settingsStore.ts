import { create } from 'zustand';
import type { TokenUsage } from '../services/qwen';
import { logSystem } from './logStore';

const QWEN_API_KEY_STORAGE_KEY = 'ai-dnd-qwen-api-key';
const DEEPSEEK_API_KEY_STORAGE_KEY = 'ai-dnd-deepseek-api-key';
const PROVIDER_STORAGE_KEY = 'ai-dnd-provider';
const QWEN_MODEL_STORAGE_KEY = 'ai-dnd-qwen-model';
const DEEPSEEK_MODEL_STORAGE_KEY = 'ai-dnd-deepseek-model';

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

  setProvider: (provider: Provider) => void;
  setApiKey: (provider: Provider, key: string | null) => void;
  setModel: (provider: Provider, model: string) => void;
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
