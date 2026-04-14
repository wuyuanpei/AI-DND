import { create } from 'zustand';

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
  deepseekApiKey: null,
  moveSpeed: 10,
  interactionRange: 50,

  setApiKey: (key) => set({ deepseekApiKey: key }),
  setMoveSpeed: (speed) => set({ moveSpeed: speed }),
  setInteractionRange: (range) => set({ interactionRange: range }),
}));