import { create } from 'zustand';
import type { DialogueMessage, DialogueNode } from '../types';

// DM 对话标识符
export const DM_NPC_ID = '__dm__';

// 对话标签
export interface DialogueTab {
  npcId: string;
  npcName: string;
  inRange: boolean; // NPC 是否在交互范围内
}

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

  // Actions
  openDialogue: (npcId: string, npcName: string, nodes: DialogueNode[], startNode: string) => void;
  openLLMDialogue: (npcId: string, npcName: string) => void;
  closeDialogue: () => void;
  selectChoice: (choiceIndex: number) => void;
  addMessage: (message: DialogueMessage) => void;
  setLoading: (loading: boolean) => void;
  // 切换标签
  switchTab: (npcId: string) => void;
  // 关闭标签
  hideTab: (npcId: string) => void;
  // 更新 NPC InRange 状态
  updateInRange: (npcId: string, inRange: boolean) => void;
  // 获取可见标签
  getVisibleTabs: () => DialogueTab[];
}

export const useDialogueStore = create<DialogueState>((set, get) => ({
  isOpen: false,
  mode: 'scripted',
  npcId: '',
  npcName: 'DM',
  currentNodeId: null,
  nodes: [],
  messages: [],
  npcMessages: {
    [DM_NPC_ID]: [
      { role: 'system', content: '你是 DND 游戏的地下城主 (DM)。请用中世纪奇幻风格与玩家互动，描述游戏世界、NPC 反应和事件结果。保持简短（不超过 50 字）。' }
    ]
  },
  npcLoading: {
    [DM_NPC_ID]: false
  },
  tabs: [
    { npcId: DM_NPC_ID, npcName: 'DM', inRange: true }
  ],
  activeTabId: DM_NPC_ID,
  isLoading: false,

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
    set((state) => {
      // 保存当前标签的消息和加载状态
      const updatedNpcMessages = {
        ...state.npcMessages,
        [state.npcId]: state.messages
      };
      const updatedNpcLoading = {
        ...state.npcLoading,
        [state.npcId]: state.isLoading
      };
      return {
        tabs: state.tabs.filter(tab => tab.npcId !== npcId),
        activeTabId: state.activeTabId === npcId ? DM_NPC_ID : state.activeTabId,
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      };
    });
  },

  // 更新 NPC InRange 状态
  updateInRange: (npcId, inRange) => {
    set((state) => ({
      tabs: state.tabs.map(tab =>
        tab.npcId === npcId ? { ...tab, inRange } : tab
      )
    }));
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

  openLLMDialogue: (npcId, npcName) => {
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
        inRange: true
      };
      set({
        tabs: [...state.tabs, newTab],
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      });
    } else {
      // 更新标签状态
      set({
        tabs: state.tabs.map(tab =>
          tab.npcId === npcId ? { ...tab, inRange: true } : tab
        ),
        npcMessages: updatedNpcMessages,
        npcLoading: updatedNpcLoading
      });
    }

    const existingMessages = state.npcMessages[npcId];

    if (existingMessages) {
      // 使用已存在的对话历史
      return set({
        isOpen: true,
        mode: 'llm',
        npcId,
        npcName,
        currentNodeId: null,
        nodes: [],
        messages: existingMessages,
        activeTabId: npcId
      });
    }

    // 创建新的对话
    return set({
      isOpen: true,
      mode: 'llm',
      npcId,
      npcName,
      currentNodeId: null,
      nodes: [],
      messages: [
        { role: 'system', content: `你是 DND 游戏中的${npcName}。请用中世纪奇幻风格与玩家对话，保持简短（不超过 50 字）。` }
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
}));
