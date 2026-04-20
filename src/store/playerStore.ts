import { create } from 'zustand';
import type { Equipment, Item, Skill } from '../types';

// 背包格子数量
export const INVENTORY_SLOTS = 28;
// 技能格子数量 - 基础 3 个，每级 +1
export const BASE_SKILL_SLOTS = 3;
// 最大等级
export const MAX_LEVEL = 10;

/**
 * 计算技能上限：基础 3 个 + 每级 +1，满级 10 级时 12 个
 * 公式：3 + (等级 - 1) = 2 + 等级
 */
export const getSkillCap = (level: number): number => {
  const cap = BASE_SKILL_SLOTS + (level - 1);
  return Math.min(cap, BASE_SKILL_SLOTS + (MAX_LEVEL - 1)); // 最多 12 个
};

export interface CharacterData {
  name: string;
  strength: number;
  agility: number;
  intelligence: number;
  charisma: number;
  gender?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
  avatar?: string;
}

export interface PlayerState {
  isCreated: boolean;
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
  // 角色设定
  gender?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
  // 头像
  avatar?: string;

  // Actions
  setName: (name: string) => void;
  createCharacter: (character: CharacterData) => void;
  resetPlayer: () => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addGold: (amount: number) => void;
  deductGold: (amount: number) => void;
  addItem: (item: Item, slot?: number) => void;
  removeItem: (slot: number) => void;
  equipItem: (item: Item, slot: number) => void;
  unequipItem: (slotKey: keyof Equipment) => void;
  organizeInventory: () => void;
}

const initialPlayerState = {
  isCreated: false,
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
  gender: undefined,
  appearance: undefined,
  personality: undefined,
  backstory: undefined,
  avatar: undefined,
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...initialPlayerState,

  setName: (name) => set({ name }),
  createCharacter: (character) => {
    const maxHp = 10 * character.strength + 5 * character.agility;
    const maxMp = 10 * character.intelligence;
    const gold = 100 * character.charisma;
    return set({
      isCreated: true,
      name: character.name,
      strength: character.strength,
      agility: character.agility,
      intelligence: character.intelligence,
      charisma: character.charisma,
      gender: character.gender,
      appearance: character.appearance,
      personality: character.personality,
      backstory: character.backstory,
      avatar: character.avatar,
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      level: 1,
      exp: 0,
      gold,
      equipment: {},
      inventory: {},
      skills: [],
    });
  },
  resetPlayer: () => set(initialPlayerState),
  takeDamage: (amount) => set((state) => ({
    hp: Math.max(0, state.hp - amount)
  })),
  heal: (amount) => set((state) => ({
    hp: Math.min(state.maxHp, state.hp + amount)
  })),
  addGold: (amount) => set((state) => ({
    gold: state.gold + amount
  })),
  deductGold: (amount) => set((state) => ({
    gold: Math.max(0, state.gold - amount)
  })),
  addItem: (item, slot) => {
    if (slot !== undefined) {
      set((state) => ({
        inventory: { ...state.inventory, [slot]: item }
      }));
    } else {
      set((state) => {
        for (let i = 0; i < INVENTORY_SLOTS; i++) {
          if (!state.inventory[i]) {
            return { inventory: { ...state.inventory, [i]: item } };
          }
        }
        // 背包满，自动扩展
        const newSlot = Object.keys(state.inventory).length;
        return { inventory: { ...state.inventory, [newSlot]: item } };
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

    const slotKey = item.type as keyof Equipment;
    const oldEquipped = state.equipment[slotKey];

    // 如果该装备栏已有装备，将其放回背包第一个空格
    if (oldEquipped) {
      const firstEmptySlot = (() => {
        for (let i = 0; i < INVENTORY_SLOTS; i++) {
          if (!newInventory[i]) return i;
        }
        // 背包满，扩展格子
        return Object.keys(newInventory).length;
      })();
      newInventory[firstEmptySlot] = oldEquipped;
    }

    return {
      equipment: {
        ...state.equipment,
        [item.type]: item
      },
      inventory: newInventory
    };
  }),
  unequipItem: (slotKey) => set((state) => {
    const item = state.equipment[slotKey];
    if (!item) return state;
    const newEquipment = { ...state.equipment };
    delete newEquipment[slotKey];
    const newInventory = { ...state.inventory };
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      if (!newInventory[i]) {
        newInventory[i] = item;
        return { equipment: newEquipment, inventory: newInventory };
      }
    }
    // 背包满，自动扩展
    const newSlot = Object.keys(newInventory).length;
    newInventory[newSlot] = item;
    return { equipment: newEquipment, inventory: newInventory };
  }),
  organizeInventory: () => set((state) => {
    const items = Object.entries(state.inventory)
      .map(([slot, item]) => item as Item)
      .filter(Boolean);

    const categoryOrder = ['melee', 'ranged', 'helmet', 'chest', 'shield', 'consumable', 'other'];

    const getCategory = (item: Item): string => {
      if (item.weaponType === 'melee') return 'melee';
      if (item.weaponType === 'ranged') return 'ranged';
      if (item.type === 'helmet') return 'helmet';
      if (item.type === 'chest' || item.type === 'armor') return 'chest';
      if (item.type === 'shield') return 'shield';
      if (item.type === 'consumable') return 'consumable';
      return 'other';
    };

    const sorted = items.sort((a, b) => {
      const catA = getCategory(a);
      const catB = getCategory(b);
      if (catA !== catB) {
        return categoryOrder.indexOf(catA) - categoryOrder.indexOf(catB);
      }
      return (b.price ?? 0) - (a.price ?? 0);
    });

    const newInventory: Record<number, Item> = {};
    sorted.forEach((item, idx) => {
      newInventory[idx] = item;
    });

    return { inventory: newInventory };
  }),
}));