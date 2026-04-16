import { create } from 'zustand';
import type { DialogueMessage, DialogueNode } from '../types';
import { DM_BASE_PROMPT } from '../config/dmConfig';

// DM 对话标识符
export const DM_NPC_ID = '__dm__';

// 对话标签
export interface DialogueTab {
  npcId: string;
  npcName: string;
}

export type DMPhase = 'creation' | 'shop' | 'adventure';

interface DialogueState {
  isOpen: boolean;
  mode: 'scripted' | 'llm';
  npcId: string;
  npcName: string;
  currentNodeId: string | null;
  nodes: DialogueNode[];
  messages: DialogueMessage[];
  // 按 NPC 存储对话历史
  npcMessages: Record<string, DialogueMessage[]>;
  // 按 NPC 存储加载状态
  npcLoading: Record<string, boolean>;
  // 对话标签列表
  tabs: DialogueTab[];
  // 当前选中的标签
  activeTabId: string;
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
  // 切换标签
  switchTab: (npcId: string) => void;
  // 关闭标签
  hideTab: (npcId: string) => void;
  // 获取可见标签
  getVisibleTabs: () => DialogueTab[];
}

const initialDialogueState = {
  isOpen: false,
  mode: 'scripted' as const,
  npcId: '',
  npcName: 'DM',
  currentNodeId: null,
  nodes: [] as DialogueNode[],
  messages: [] as DialogueMessage[],
  npcMessages: {
    [DM_NPC_ID]: [
      { role: 'system' as const, content: DM_BASE_PROMPT }
    ]
  },
  npcLoading: {
    [DM_NPC_ID]: false
  },
  tabs: [
    { npcId: DM_NPC_ID, npcName: 'DM' }
  ],
  activeTabId: DM_NPC_ID,
  isLoading: false,
  dmPhase: 'creation' as const,
};

export const useDialogueStore = create<DialogueState>((set, get) => ({
  ...initialDialogueState,

  // 获取可见标签
  getVisibleTabs: () => {
    const state = get();
    return state.tabs;
  },

  // 切换标签
  switchTab: (npcId) => {
    const state = get();
    const tab = state.tabs.find(t => t.npcId === npcId);
    if (!tab) return;

    // 保存当前标签的消息和加载状态
    const currentNpcId = state.npcId;
    const updatedNpcMessages = {
      ...state.npcMessages,
      [currentNpcId]: state.messages
    };
    const updatedNpcLoading = {
      ...state.npcLoading,
      [currentNpcId]: state.isLoading
    };

    const existingMessages = state.npcMessages[npcId] || [];
    const existingLoading = state.npcLoading[npcId] || false;

    set({
      activeTabId: npcId,
      npcId,
      npcName: tab.npcName,
      messages: existingMessages,
      isLoading: existingLoading,
      npcMessages: updatedNpcMessages,
      npcLoading: updatedNpcLoading
    });
  },

  // 关闭标签（删除）
  hideTab: (npcId) => {
    if (npcId === DM_NPC_ID) return; // DM 标签不能被删除
    const state = get();
    // 保存当前标签的消息和加载状态
    const currentNpcId = state.npcId;
    const updatedNpcMessages = {
      ...state.npcMessages,
      [currentNpcId]: state.messages
    };
    const updatedNpcLoading = {
      ...state.npcLoading,
      [currentNpcId]: state.isLoading
    };

    const newActiveId = state.activeTabId === npcId ? DM_NPC_ID : state.activeTabId;
    const dmMessages = updatedNpcMessages[DM_NPC_ID] || [];
    const dmLoading = updatedNpcLoading[DM_NPC_ID] || false;
    const dmTab = state.tabs.find(t => t.npcId === DM_NPC_ID);

    set({
      tabs: state.tabs.filter(tab => tab.npcId !== npcId),
      activeTabId: newActiveId,
      npcId: newActiveId,
      npcName: dmTab?.npcName || 'DM',
      messages: newActiveId === DM_NPC_ID ? dmMessages : (updatedNpcMessages[newActiveId] || []),
      isLoading: newActiveId === DM_NPC_ID ? dmLoading : (updatedNpcLoading[newActiveId] || false),
      npcMessages: updatedNpcMessages,
      npcLoading: updatedNpcLoading
    });
  },

  openDialogue: (npcId, npcName, nodes, startNode) => {
    const state = get();
    // 保存当前标签的消息
    const currentNpcId = state.npcId;
    const updatedNpcMessages = {
      ...state.npcMessages,
      [currentNpcId]: state.messages
    };
    set({
      isOpen: true,
      mode: 'scripted',
      npcId,
      npcName,
      nodes,
      currentNodeId: startNode,
      messages: [],
      npcMessages: updatedNpcMessages
    });
  },

  openLLMDialogue: (npcId, npcName, systemPrompt) => {
    const state = get();

    // 检查是否已存在该 NPC 的标签
    const existingTab = state.tabs.find(t => t.npcId === npcId);

    // 保存当前标签的消息
    const currentNpcId = state.npcId;
    const updatedNpcMessages = {
      ...state.npcMessages,
      [currentNpcId]: state.messages
    };
    const updatedNpcLoading = {
      ...state.npcLoading,
      [npcId]: state.npcLoading[npcId] || false
    };

    if (!existingTab) {
      // 创建新标签
      const newTab: DialogueTab = {
        npcId,
        npcName,
      };
      set({
        tabs: [...state.tabs, newTab],
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      });
    } else {
      set({
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      });
    }

    const existingMessages = state.npcMessages[npcId];

    if (existingMessages) {
      // 使用已存在的对话历史，但如果传入了新的 systemPrompt，更新第一条 system 消息
      let messagesToUse = existingMessages;
      if (
        systemPrompt &&
        existingMessages[0]?.role === 'system' &&
        existingMessages[0].content !== systemPrompt
      ) {
        messagesToUse = [
          { role: 'system' as const, content: systemPrompt },
          ...existingMessages.slice(1)
        ];
      }
      return set({
        isOpen: true,
        mode: 'llm',
        npcId,
        npcName,
        currentNodeId: null,
        nodes: [],
        messages: messagesToUse,
        activeTabId: npcId
      });
    }

    // 创建新的对话，优先使用传入的系统提示词
    const defaultPrompt = npcId === DM_NPC_ID
      ? DM_BASE_PROMPT
      : `你是 DND 游戏中的${npcName}。请用中世纪奇幻风格与玩家对话。`;

    return set({
      isOpen: true,
      mode: 'llm',
      npcId,
      npcName,
      currentNodeId: null,
      nodes: [],
      messages: [
        { role: 'system', content: systemPrompt ?? defaultPrompt }
      ],
      activeTabId: npcId
    });
  },

  closeDialogue: () => {
    const state = get();
    // 保存当前 NPC 的对话历史和加载状态
    if (state.npcId && state.messages.length > 0) {
      const updatedNpcMessages = {
        ...state.npcMessages,
        [state.npcId]: state.messages
      };
      const updatedNpcLoading = {
        ...state.npcLoading,
        [state.npcId]: state.isLoading
      };
      set({
        isOpen: false,
        npcId: '',
        npcName: '',
        currentNodeId: null,
        nodes: [],
        messages: [],
        isLoading: false,
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      });
    } else {
      set({
        isOpen: false,
        npcId: '',
        npcName: '',
        currentNodeId: null,
        nodes: [],
        messages: [],
        isLoading: false
      });
    }
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

  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, message];
    // 同时更新 npcMessages
    const updatedNpcMessages = {
      ...state.npcMessages,
      [state.npcId]: newMessages
    };
    return {
      messages: newMessages,
      npcMessages: updatedNpcMessages
    };
  }),

  setLoading: (loading) => set((state) => ({
    isLoading: loading,
    // 同时更新 npcLoading
    npcLoading: {
      ...state.npcLoading,
      [state.npcId]: loading
    }
  })),

  setDMPhase: (phase) => set({ dmPhase: phase }),
  resetDialogue: () => set(initialDialogueState),
}));
