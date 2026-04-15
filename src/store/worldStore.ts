import { create } from 'zustand';

interface WorldState {
  // 世界状态暂未使用
}

export const useWorldStore = create<WorldState>(() => ({}));
