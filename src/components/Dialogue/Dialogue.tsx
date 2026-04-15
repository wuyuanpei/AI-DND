import React, { useState, useEffect, useRef } from 'react';
import { useDialogueStore, DM_NPC_ID } from '../../store/dialogueStore';
import { useSettingsStore } from '../../store/settingsStore';
import { logError } from '../../store/logStore';
import { DM_BASE_PROMPT } from '../../config/dmConfig';
import { chatWithNPC } from '../../services/qwen';
import type { ChatMessage } from '../../services/qwen';
import type { DialogueMessage } from '../../types';
import { parseLLMJson } from '../../utils/parseLLMJson';

const Dialogue: React.FC = () => {
  const store = useDialogueStore();
  const {
    isOpen,
    mode,
    currentNodeId,
    nodes,
    messages,
    isLoading,
    selectChoice,
    addMessage,
    setLoading,
    switchTab,
    hideTab,
    getVisibleTabs,
    openLLMDialogue,
  } = store;

  const { addApiUsage } = useSettingsStore();
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visibleTabs = getVisibleTabs();
  const activeTabId = store.activeTabId;
  const isDM = activeTabId === DM_NPC_ID;

  // 初始化时自动打开 DM 对话
  useEffect(() => {
    if (!isOpen) {
      openLLMDialogue(DM_NPC_ID, 'DM', DM_BASE_PROMPT);
    }
  }, []);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 获取当前对话节点
  const currentNode = nodes.find((n) => n.id === currentNodeId);

  // 处理 LLM 对话输入
  const handleLLMSubmit = async () => {
    const apiKey = useSettingsStore.getState().getCurrentApiKey();
    const model = useSettingsStore.getState().getCurrentModel();
    const apiUrl = useSettingsStore.getState().getCurrentApiUrl();
    if (!userInput.trim() || !apiKey) return;

    // 保存当前的 npcId 和 npcName，防止切换 tab 时变化
    const currentNpcId = store.npcId;
    const currentNpcName = store.npcName;

    // 获取历史对话（排除 system 消息）
    const historyMessages: DialogueMessage[] = store.messages.filter(m => m.role !== 'system');

    // 构建系统提示词
    const systemPrompt = currentNpcId === DM_NPC_ID
      ? DM_BASE_PROMPT
      : `你是 DND 游戏中的${currentNpcName}。请用中世纪奇幻风格与玩家对话。`;

    setLoading(true);
    addMessage({ role: 'user', content: userInput });
    setUserInput('');

    try {
      // 将 DialogueMessage 转换为 ChatMessage 格式（npc 角色转为 assistant）
      const history: ChatMessage[] = historyMessages.map(m => ({
        role: m.role === 'npc' ? 'assistant' : m.role,
        content: m.content
      }));

      const response = await chatWithNPC(
        currentNpcId === DM_NPC_ID ? 'DM' : currentNpcName,
        systemPrompt,
        history,
        userInput,
        apiKey,
        model,
        apiUrl
      );
      // 更新 API 统计
      addApiUsage(response.usage);
      let replyContent = response.content;
      // 如果是 DM，尝试解析 JSON 响应，提取 dialogue 字段
      if (currentNpcId === DM_NPC_ID) {
        const result = parseLLMJson(response.content);
        if (result.dialogue) {
          replyContent = result.dialogue.trim();
        } else if (result.error) {
          logError('DM JSON 响应解析失败', `${result.error}; 原始内容: ${response.content.slice(0, 500)}`);
        } else {
          logError('DM JSON 响应缺少 dialogue 字段', `原始内容: ${response.content.slice(0, 500)}`);
        }
      }
      // 使用保存的 npcId 添加回复，确保添加到正确的 tab
      addMessageToNpc(currentNpcId, { role: 'assistant', content: replyContent });
    } catch (error) {
      addMessageToNpc(currentNpcId, { role: 'assistant', content: '（对话出错...）' });
    } finally {
      // 使用保存的 npcId 设置加载状态，确保更新正确的 tab
      setLoadingForNpc(currentNpcId, false);
    }
  };

  // 添加到指定 NPC 的消息
  const addMessageToNpc = (npcId: string, message: DialogueMessage) => {
    const state = useDialogueStore.getState();
    const currentMessages = state.npcMessages[npcId] || [];
    const newMessages = [...currentMessages, message];
    const updatedNpcMessages = {
      ...state.npcMessages,
      [npcId]: newMessages
    };
    useDialogueStore.setState({
      npcMessages: updatedNpcMessages,
      // 如果当前正在查看这个 NPC，也更新 messages
      ...(state.activeTabId === npcId ? { messages: newMessages } : {})
    });
  };

  // 设置指定 NPC 的加载状态
  const setLoadingForNpc = (npcId: string, loading: boolean) => {
    const state = useDialogueStore.getState();
    const updatedNpcLoading = {
      ...state.npcLoading,
      [npcId]: loading
    };
    useDialogueStore.setState({
      isLoading: state.activeTabId === npcId ? loading : state.isLoading,
      npcLoading: updatedNpcLoading
    });
  };

  // 关闭 NPC 标签，返回 DM
  const handleCloseNPCTab = () => {
    // 只切换回 DM，不关闭 tab
    switchTab(DM_NPC_ID);
    setUserInput('');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden min-w-0" style={{ minWidth: 0 }}>
      {/* Tab 导航栏 */}
      <div className="flex-shrink-0 border-b border-gray-600 pb-1">
        <div className="flex items-center gap-1 overflow-x-hidden">
          {/* 可见标签 */}
          {visibleTabs.map(tab => (
            <div
              key={tab.npcId}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${
                activeTabId === tab.npcId
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              onClick={() => switchTab(tab.npcId)}
            >
              <span>{tab.npcName}</span>
              {tab.npcId !== DM_NPC_ID && (
                <button
                  className="text-gray-400 hover:text-white text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    hideTab(tab.npcId);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 对话内容 - 固定高度可滚动区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden mb-2 text-white text-sm min-h-0 max-h-full min-w-0" style={{ minWidth: 0, width: '992px' }}>
        {/* 脚本模式：显示当前节点文本 */}
        {mode === 'scripted' && currentNode && (
          <div
            className="bg-gray-600 rounded p-2 mb-2"
            style={{ width: '992px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
          >{currentNode.text}</div>
        )}

        {/* LLM 模式：显示对话历史 */}
        {mode === 'llm' && (
          <div className="space-y-2" style={{ width: '992px', minWidth: 0 }}>
            {messages
              .filter((m) => m.role !== 'system')
              .map((msg, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded"
                  style={{
                    width: '892px',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    borderRadius: '8px',
                    background: msg.role === 'user' ? '#2563eb' : '#4b5563',
                    marginLeft: msg.role === 'user' ? '100px' : '0',
                    marginRight: msg.role === 'user' ? '0' : '100px',
                  }}
                >
                  {msg.content}
                </div>
              ))}
            {isLoading && (
              <div className="text-gray-400 text-center">思考中...</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 选项/输入区域 */}
      <div className="flex-shrink-0">
        {/* 脚本模式：显示选项 */}
        {mode === 'scripted' && currentNode?.choices && (
          <div className="space-y-1">
            {currentNode.choices.map((choice, idx) => (
              <button
                key={idx}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white text-xs p-2 rounded text-left"
                onClick={() => selectChoice(idx)}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}

        {/* LLM 模式：输入框 */}
        {mode === 'llm' && (
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-600 text-white text-sm p-2 rounded border border-gray-500 focus:border-blue-400 outline-none disabled:opacity-50"
              placeholder="输入消息..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLLMSubmit()}
              disabled={isLoading}
            />
            <button
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 rounded disabled:opacity-50"
              onClick={handleLLMSubmit}
              disabled={isLoading || !userInput.trim()}
            >
              发送
            </button>
          </div>
        )}
      </div>

      {/* 关闭按钮 - 仅 NPC 标签显示 */}
      {!isDM && (
        <button
          className="mt-2 text-gray-400 hover:text-white text-xs flex-shrink-0"
          onClick={handleCloseNPCTab}
        >
          [返回 DM]
        </button>
      )}
    </div>
  );
};

export default Dialogue;
