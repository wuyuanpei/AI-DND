import { create } from 'zustand';
import type { DialogueMessage, DialogueNode } from '../types';

interface DialogueState {
  isOpen: boolean;
  mode: 'scripted' | 'llm';
  npcId: string;
  npcName: string;
  currentNodeId: string | null;
  nodes: DialogueNode[];
  messages: DialogueMessage[];
  isLoading: boolean;

  // Actions
  openDialogue: (npcId: string, npcName: string, nodes: DialogueNode[], startNode: string) => void;
  openLLMDialogue: (npcId: string, npcName: string) => void;
  closeDialogue: () => void;
  selectChoice: (choiceIndex: number) => void;
  addMessage: (message: DialogueMessage) => void;
  setLoading: (loading: boolean) => void;
}

export const useDialogueStore = create<DialogueState>((set) => ({
  isOpen: false,
  mode: 'scripted',
  npcId: '',
  npcName: '',
  currentNodeId: null,
  nodes: [],
  messages: [],
  isLoading: false,

  openDialogue: (npcId, npcName, nodes, startNode) => set({
    isOpen: true,
    mode: 'scripted',
    npcId,
    npcName,
    nodes,
    currentNodeId: startNode,
    messages: []
  }),

  openLLMDialogue: (npcId, npcName) => set({
    isOpen: true,
    mode: 'llm',
    npcId,
    npcName,
    currentNodeId: null,
    nodes: [],
    messages: [
      { role: 'system', content: `你是DND游戏中的${npcName}。请用中世纪奇幻风格与玩家对话，保持简短（不超过50字）。` }
    ]
  }),

  closeDialogue: () => set({
    isOpen: false,
    npcId: '',
    npcName: '',
    currentNodeId: null,
    nodes: [],
    messages: []
  }),

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
}));