import { create } from 'zustand';
import type { DialogueMessage, DialogueNode } from '../types';

export type DMPhase = 'creation' | 'shop' | 'adventure';

export const getDMName = (phase: DMPhase): string => {
  if (phase === 'creation' || phase === 'shop') return '冒险向导';
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
