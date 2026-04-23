import { create } from 'zustand';
import type { DialogueMessage, DialogueNode, WeaponPreset, ArmorPreset, AttackPayload } from '../types';
import type { CombatMonsterState } from '../utils/combatEngine';

export type DMPhase = 'creation' | 'shop' | 'adventure' | 'combat';

export const getDMName = (phase: DMPhase): string => {
  if (phase === 'creation' || phase === 'shop') return '冒险向导';
  if (phase === 'combat') return '战斗裁判';
  return '冒险主持人';
};

interface DialogueState {
  isOpen: boolean;
  mode: 'scripted' | 'llm';
  npcId: string;
  npcName: string;
  currentNodeId: string | null;
  nodes: DialogueNode[];
  messages: DialogueMessage[];
  isLoading: boolean;
  // DM 当前阶段
  dmPhase: DMPhase;
  // 商店阶段武器选择
  shopWeapons: WeaponPreset[];
  selectedWeaponIds: Set<string>;
  purchasedWeaponIds: Set<string>;
  // 商店阶段防具选择
  shopArmors: ArmorPreset[];
  selectedArmorIds: Set<string>;
  purchasedArmorIds: Set<string>;

  // Combat state
  combatHistoryKey: string | null;
  preCombatMessages: DialogueMessage[];
  combatMonsterIds: string[];
  combatAttackPayload: AttackPayload | null;
  pendingAttack: AttackPayload | null;
  pendingCombatResult: { outcome: 'victory' | 'defeat'; battleSummary?: string } | null;
  // New combat engine state
  combatMonsters: CombatMonsterState[];
  combatTurn: 'player' | 'monster';
  combatRound: number;
  combatMonsterIndex: number; // 当前行动怪物的索引（怪物回合时使用）

  // Actions
  openDialogue: (npcId: string, npcName: string, nodes: DialogueNode[], startNode: string) => void;
  openLLMDialogue: (npcId: string, npcName: string, systemPrompt?: string) => void;
  closeDialogue: () => void;
  selectChoice: (choiceIndex: number) => void;
  addMessage: (message: DialogueMessage) => void;
  setLoading: (loading: boolean) => void;
  resetDialogue: () => void;
  setDMPhase: (phase: DMPhase) => void;
}

const initialDialogueState = {
  isOpen: false,
  mode: 'scripted' as const,
  npcId: '',
  npcName: '',
  currentNodeId: null,
  nodes: [] as DialogueNode[],
  messages: [] as DialogueMessage[],
  isLoading: false,
  dmPhase: 'creation' as const,
  shopWeapons: [] as WeaponPreset[],
  selectedWeaponIds: new Set<string>(),
  purchasedWeaponIds: new Set<string>(),
  shopArmors: [] as ArmorPreset[],
  selectedArmorIds: new Set<string>(),
  purchasedArmorIds: new Set<string>(),
  combatHistoryKey: null,
  preCombatMessages: [] as DialogueMessage[],
  combatMonsterIds: [] as string[],
  combatAttackPayload: null,
  pendingAttack: null,
  pendingCombatResult: null,
  combatMonsters: [] as CombatMonsterState[],
  combatTurn: 'player' as const,
  combatRound: 1,
  combatMonsterIndex: 0,
};

export const useDialogueStore = create<DialogueState>((set) => ({
  ...initialDialogueState,

  openDialogue: (npcId, npcName, nodes, startNode) => {
    set({
      isOpen: true,
      mode: 'scripted',
      npcId,
      npcName,
      nodes,
      currentNodeId: startNode,
      messages: [],
    });
  },

  openLLMDialogue: (npcId, npcName, systemPrompt) => {
    set((state) => {
      const existing = state.messages;
      let messagesToUse = existing;
      if (systemPrompt) {
        if (existing[0]?.role === 'system') {
          messagesToUse = [{ role: 'system' as const, content: systemPrompt }, ...existing.slice(1)];
        } else {
          messagesToUse = [{ role: 'system' as const, content: systemPrompt }, ...existing];
        }
      }
      return {
        isOpen: true,
        mode: 'llm',
        npcId,
        npcName,
        currentNodeId: null,
        nodes: [],
        messages: messagesToUse,
      };
    });
  },

  closeDialogue: () => {
    set({ isOpen: false });
  },

  selectChoice: (choiceIndex) => set((state) => {
    const current = state.nodes.find(n => n.id === state.currentNodeId);
    if (!current?.choices) return state;

    const choice = current.choices[choiceIndex];
    if (!choice) return state;

    return {
      currentNodeId: choice.next || null,
      messages: [
        ...state.messages,
        { role: 'npc', content: current.text },
        { role: 'user', content: choice.text }
      ]
    };
  }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setDMPhase: (phase) => set({ dmPhase: phase }),
  resetDialogue: () => set(initialDialogueState),
}));
