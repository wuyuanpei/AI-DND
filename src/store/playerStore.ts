import { create } from 'zustand';
import type { Position, Equipment, Item, Skill } from '../types';

interface PlayerState {
  name: string;
  level: number;
  position: Position;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  gold: number;
  equipment: Equipment;
  inventory: Item[];
  skills: Skill[];

  // Actions
  setName: (name: string) => void;
  setPosition: (pos: Position) => void;
  move: (dx: number, dy: number) => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addGold: (amount: number) => void;
  addItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  equipItem: (item: Item) => void;
}

const initialPosition: Position = { x: 512, y: 512 };

export const usePlayerStore = create<PlayerState>((set) => ({
  name: '冒险者',
  level: 1,
  position: initialPosition,
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  exp: 0,
  gold: 0,
  equipment: {},
  inventory: [],
  skills: [],

  setName: (name) => set({ name }),
  setPosition: (pos) => set({ position: pos }),
  move: (dx, dy) => set((state) => ({
    position: {
      x: state.position.x + dx,
      y: state.position.y + dy
    }
  })),
  takeDamage: (amount) => set((state) => ({
    hp: Math.max(0, state.hp - amount)
  })),
  heal: (amount) => set((state) => ({
    hp: Math.min(state.maxHp, state.hp + amount)
  })),
  addGold: (amount) => set((state) => ({
    gold: state.gold + amount
  })),
  addItem: (item) => set((state) => ({
    inventory: [...state.inventory, item]
  })),
  removeItem: (itemId) => set((state) => ({
    inventory: state.inventory.filter(i => i.id !== itemId)
  })),
  equipItem: (item) => set((state) => ({
    equipment: {
      ...state.equipment,
      [item.type]: item
    },
    inventory: state.inventory.filter(i => i.id !== item.id)
  })),
}));