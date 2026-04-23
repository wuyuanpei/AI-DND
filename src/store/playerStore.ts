import { create } from 'zustand';
import type { Equipment, Item, Skill } from '../types';

// 背包格子数量
export const INVENTORY_SLOTS = 28;
// 最大等级
export const MAX_LEVEL = 10;

const WEAPON_SKILL_NAMES: Record<string, string> = {
  mainWeapon: '近战-主武',
  offWeapon: '近战-副武',
  ranged: '远程武器',
};

function buildUnarmedSkill(strength: number): Skill {
  return {
    id: 'skill_unarmed',
    name: '赤手空拳',
    description: '不使用武器，仅凭肉身之力进行攻击。伤害为力量除以2，向下取整。',
    type: 'active',
    damage: `${Math.floor(strength / 2)}`,
    icon: 'skills/skill_unarmed.png',
  };
}

function buildWeaponSkill(item: Item): Skill {
  const name = WEAPON_SKILL_NAMES[item.type] || item.name;
  return {
    id: `skill_${item.type}`,
    name,
    description: `使用${item.name}进行攻击。${item.description}`,
    type: 'active',
    damage: item.damage,
    icon: item.icon ? `skills/skill_${item.type}.png` : undefined,
  };
}

function hasAnyWeapon(equipment: Equipment): boolean {
  return !!(equipment.mainWeapon || equipment.offWeapon || equipment.ranged);
}

const AUTO_SKILL_IDS = new Set(['skill_unarmed', 'skill_mainWeapon', 'skill_offWeapon', 'skill_ranged']);

export function refreshWeaponSkills(equipment: Equipment, strength: number, currentSkills: Skill[]): Skill[] {
  const hasWeapon = hasAnyWeapon(equipment);
  let skills = currentSkills.filter((s) => !AUTO_SKILL_IDS.has(s.id));

  if (hasWeapon) {
    if (equipment.mainWeapon) {
      skills.push(buildWeaponSkill(equipment.mainWeapon));
    }
    if (equipment.offWeapon) {
      skills.push(buildWeaponSkill(equipment.offWeapon));
    }
    if (equipment.ranged) {
      skills.push(buildWeaponSkill(equipment.ranged));
    }
  } else {
    skills.push(buildUnarmedSkill(strength));
  }

  return skills;
}

/**
 * 计算从当前等级升到下一级所需的经验值
 * 1→2: 100, 2→3: 200, 3→4: 400, ... (每级翻倍)
 */
export const getExpToNext = (level: number): number => {
  return 100 * Math.pow(2, level - 1);
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
  addExp: (amount: number) => void;
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
      skills: [buildUnarmedSkill(character.strength)],
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
  addExp: (amount) => set((state) => {
    if (state.level >= MAX_LEVEL) {
      // 已满级，经验只积累但不升级
      return { exp: state.exp + amount };
    }

    let newExp = state.exp + amount;
    let newLevel = state.level;
    let newMaxHp = state.maxHp;
    let newMaxMp = state.maxMp;
    let newHp = state.hp;
    let newMp = state.mp;

    while (newLevel < MAX_LEVEL && newExp >= getExpToNext(newLevel)) {
      newExp -= getExpToNext(newLevel);
      newLevel += 1;

      // 升级后重新计算 HP/MP
      const baseMaxHp = 10 * state.strength + 5 * state.agility;
      const baseMaxMp = 10 * state.intelligence;
      // 装备提供的加成需要保留
      const equipmentMaxHp = state.maxHp - baseMaxHp;
      newMaxHp = baseMaxHp + equipmentMaxHp;
      newMaxMp = baseMaxMp;
      // 升级时 HP/MP 回满
      newHp = newMaxHp;
      newMp = newMaxMp;
    }

    return {
      level: newLevel,
      exp: newExp,
      maxHp: newMaxHp,
      maxMp: newMaxMp,
      hp: newHp,
      mp: newMp,
    };
  }),
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

    const newEquipment = {
      ...state.equipment,
      [item.type]: item
    };

    const newSkills = refreshWeaponSkills(newEquipment, state.strength, state.skills);

    return {
      equipment: newEquipment,
      inventory: newInventory,
      skills: newSkills,
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
        const newSkills = refreshWeaponSkills(newEquipment, state.strength, state.skills);
        return { equipment: newEquipment, inventory: newInventory, skills: newSkills };
      }
    }
    // 背包满，自动扩展
    const newSlot = Object.keys(newInventory).length;
    newInventory[newSlot] = item;
    const newSkills = refreshWeaponSkills(newEquipment, state.strength, state.skills);
    return { equipment: newEquipment, inventory: newInventory, skills: newSkills };
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