// 玩家状态
export interface Equipment {
  helmet?: Item;
  chest?: Item;
  shield?: Item;
  mainWeapon?: Item;
  offWeapon?: Item;
  ranged?: Item;
  top?: Item;
  pants?: Item;
  boots?: Item;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'helmet' | 'boots' | 'consumable' |
        'chest' | 'shield' | 'mainWeapon' | 'offWeapon' | 'ranged' |
        'top' | 'pants';
  description: string;
  stats?: Record<string, number>;
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
