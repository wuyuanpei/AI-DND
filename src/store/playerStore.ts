import { create } from 'zustand';
import type { Equipment, Item, Skill } from '../types';

// 背包格子数量
export const INVENTORY_SLOTS = 28;
// 技能格子数量 - 基础 3 个，每级 +1
export const BASE_SKILL_SLOTS = 3;
// 最大等级
export const MAX_LEVEL = 10;
// 背包重量上限
export const WEIGHT_LIMIT = 50;

/**
 * 计算技能上限：基础 3 个 + 每级 +1，满级 10 级时 12 个
 * 公式：3 + (等级 - 1) = 2 + 等级
 */
export const getSkillCap = (level: number): number => {
  const cap = BASE_SKILL_SLOTS + (level - 1);
  return Math.min(cap, BASE_SKILL_SLOTS + (MAX_LEVEL - 1)); // 最多 12 个
};

interface PlayerState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  gold: number;
  equipment: Equipment;
  inventory: Record<number, Item>; // 使用数字索引作为 key
  skills: Skill[];
  // 四维属性
  strength: number; // 力量
  agility: number; // 敏捷
  intelligence: number; // 智力
  charisma: number; // 魅力

  // Actions
  setName: (name: string) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addGold: (amount: number) => void;
  addItem: (item: Item, slot?: number) => void;
  removeItem: (slot: number) => void;
  equipItem: (item: Item, slot: number) => void;
  getCurrentWeight: () => number;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  name: '冒险者',
  level: 1,
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  exp: 0,
  gold: 0,
  equipment: {},
  inventory: {},
  skills: [],
  strength: 10,
  agility: 10,
  intelligence: 10,
  charisma: 10,

  setName: (name) => set({ name }),
  takeDamage: (amount) => set((state) => ({
    hp: Math.max(0, state.hp - amount)
  })),
  heal: (amount) => set((state) => ({
    hp: Math.min(state.maxHp, state.hp + amount)
  })),
  addGold: (amount) => set((state) => ({
    gold: state.gold + amount
  })),
  addItem: (item, slot) => {
    if (slot !== undefined) {
      set((state) => ({
        inventory: { ...state.inventory, [slot]: item }
      }));
    } else {
      // 寻找第一个空槽
      set((state) => {
        for (let i = 0; i < INVENTORY_SLOTS; i++) {
          if (!state.inventory[i]) {
            return { inventory: { ...state.inventory, [i]: item } };
          }
        }
        return state;
      });
    }
  },
  removeItem: (slot) => set((state) => {
    const newInventory = { ...state.inventory };
    delete newInventory[slot];
    return { inventory: newInventory };
  }),
  equipItem: (item, slot) => set((state) => {
    const newInventory = { ...state.inventory };
    delete newInventory[slot];
    return {
      equipment: {
        ...state.equipment,
        [item.type]: item
      },
      inventory: newInventory
    };
  }),
  getCurrentWeight: () => {
    const state = get();
    return Object.keys(state.inventory).length;
  },
}));