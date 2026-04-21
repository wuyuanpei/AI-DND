export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

// 玩家状态
export interface Equipment {
  helmet?: Item;
  chest?: Item;
  shield?: Item;
  mainWeapon?: Item;
  offWeapon?: Item;
  ranged?: Item;
}

// 运行时物品（玩家背包/装备中的实际物品）
// 武器类 item 可以通过 WeaponPreset 补充 type 后生成
export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'helmet' | 'consumable' |
        'chest' | 'shield' | 'mainWeapon' | 'offWeapon' | 'ranged';
  description: string;
  rarity?: Rarity;
  weaponType?: 'melee' | 'ranged';
  damage?: string;
  icon?: string;
  price?: number;           // 购买价格
  effect?: string;          // 特殊效果描述
  durability?: number;      // 当前剩余使用次数
  maxDurability?: number;   // 持久度上限
  stats?: Record<string, number>;
}

// 武器预设（来自 weapons.json 的静态数据）
// 与 Item 的区别：不含 type 字段，因为近战武器可装主武或副武
// 装备时由前端根据玩家选择补充 type 来生成 Item
export interface WeaponPreset {
  id: string;
  name: string;
  weaponType: 'melee' | 'ranged';
  description: string;
  rarity: Rarity;
  damage: string;
  durability: number;  // 持久度上限（可使用的次数）
  price: number;       // 购买价格（金币）
  effect?: string;     // 特殊效果描述（普通武器无，稀有部分有，史诗基本有，传说全有）
  icon: string;
}

// 防具预设（来自 armors.json 的静态数据）
// 与 Item 的区别：不含 type 字段，装备时由前端根据 armorType 补充 type
export interface ArmorPreset {
  id: string;
  name: string;
  armorType: 'helmet' | 'chest' | 'shield';
  description: string;
  rarity: Rarity;
  defense?: number;       // 盾牌防御值
  damageReduction?: number; // 头盔伤害减免百分比 (0.1 = 10%)
  bonusHp?: number;       // 护甲额外生命值
  durability: number;
  price: number;
  effect?: string;
  icon: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'active' | 'passive';
  cost?: number; // MP消耗
  cooldown?: number;
}

// 对话系统
export interface DialogueMessage {
  role: 'system' | 'user' | 'assistant' | 'npc';
  content: string;
  rawJson?: string; // 完整 LLM 返回 JSON
}

export interface DialogueChoice {
  text: string;
  next?: string;
  action?: DialogueAction;
}

export interface DialogueAction {
  type: 'setFlag' | 'addItem' | 'removeItem' | 'teleport' | 'startQuest';
  key?: string;
  value?: unknown;
}

export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string;
  choices?: DialogueChoice[];
  actions?: DialogueAction[];
}

export interface DialogueData {
  id: string;
  npcName: string;
  nodes: DialogueNode[];
  startNode: string;
}
