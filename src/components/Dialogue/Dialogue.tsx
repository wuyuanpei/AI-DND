import React, { useState, useEffect, useRef } from 'react';
import { useDialogueStore, DM_NPC_ID } from '../../store/dialogueStore';
import { useSettingsStore, IMAGE_API_URL } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { logError, logMemory } from '../../store/logStore';
import { savePlayerJson, saveAvatar } from '../../utils/playerDB';
import { savePlayerStatsToStorage } from '../../utils/playerStats';

const writePlayerJsonToDB = (name: string, gender: string, appearance: string, personality: string, backstory: string) => {
  void savePlayerJson({ name, gender, appearance, personality, backstory }).catch((e) => logError('保存玩家文本到 IndexedDB 失败', e instanceof Error ? e.message : String(e)));
};
import { DM_BASE_PROMPT, DM_CHARACTER_CREATION_PROMPT } from '../../config/dmConfig';
import { chatWithNPC } from '../../services/qwen';
import { generateCharacterPortrait } from '../../services/imageGen';
import { buildPortraitPrompt } from '../../config/imageConfig';
import type { ChatMessage } from '../../services/qwen';
import type { DialogueMessage } from '../../types';
import type { CharacterData } from '../../store/playerStore';
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
  const playerIsCreated = usePlayerStore((state) => state.isCreated);
  const createCharacter = usePlayerStore((state) => state.createCharacter);
  const [userInput, setUserInput] = useState('');
  const [npcOptions, setNpcOptions] = useState<Record<string, string[]>>({});
  const [pendingCharacter, setPendingCharacter] = useState<CharacterData | null>(null);
  const [generatingAvatars, setGeneratingAvatars] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visibleTabs = getVisibleTabs();
  const activeTabId = store.activeTabId;
  const isDM = activeTabId === DM_NPC_ID;

  // 渲染 **粗体**
  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // 初始化时自动打开 DM 对话
  useEffect(() => {
    if (!isOpen) {
      const prompt = playerIsCreated ? DM_BASE_PROMPT : DM_CHARACTER_CREATION_PROMPT;
      openLLMDialogue(DM_NPC_ID, 'DM', prompt);
    }
  }, [isOpen, openLLMDialogue, playerIsCreated]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // DM 自动发起首轮对话（角色创建问候或游戏开场）
  useEffect(() => {
    if (
      isOpen &&
      activeTabId === DM_NPC_ID &&
      !isLoading &&
      messages.filter((m) => m.role !== 'system').length === 0
    ) {
      const systemPrompt = playerIsCreated ? DM_BASE_PROMPT : DM_CHARACTER_CREATION_PROMPT;
      sendToLLM(DM_NPC_ID, 'DM', systemPrompt, '（玩家刚刚进入游戏，请主动向玩家打招呼并开启对话。）', false);
    }
  }, [isOpen, activeTabId, isLoading, messages, playerIsCreated]);

  // 获取当前对话节点
  const currentNode = nodes.find((n) => n.id === currentNodeId);

  // 创建角色并写入记忆（不带头像，头像后续单独更新）
  const writePlayerMemoryAndCreateCharacter = (character: CharacterData) => {
    createCharacter(character);
    writePlayerJsonToDB(character.name, character.gender ?? '', character.appearance ?? '', character.personality ?? '', character.backstory ?? '');
    savePlayerStatsToStorage();
    logMemory('写入玩家记忆卡片', `key: ai-dnd-player-md, name: ${character.name}`);

    const dState = useDialogueStore.getState();
    const dmMessages = dState.npcMessages[DM_NPC_ID] || [];
    if (dmMessages.length > 0 && dmMessages[0].role === 'system') {
      const newDmMessages = [
        { role: 'system' as const, content: DM_BASE_PROMPT },
        ...dmMessages.slice(1),
      ];
      useDialogueStore.setState({
        npcMessages: {
          ...dState.npcMessages,
          [DM_NPC_ID]: newDmMessages,
        },
        ...(dState.activeTabId === DM_NPC_ID ? { messages: newDmMessages } : {}),
      });
    }
  };

  // 更新玩家头像
  const updatePlayerAvatar = async (avatarUrl: string) => {
    usePlayerStore.setState({ avatar: avatarUrl });

    // 从云端下载图片 Blob 并保存到 IndexedDB
    try {
      const res = await fetch(avatarUrl);
      const blob = await res.blob();
      await saveAvatar(blob);
    } catch (e) {
      logError('保存头像 Blob 到 IndexedDB 失败', e instanceof Error ? e.message : String(e));
    }

    const state = usePlayerStore.getState();
    writePlayerJsonToDB(state.name, state.gender ?? '', state.appearance ?? '', state.personality ?? '', state.backstory ?? '');
    savePlayerStatsToStorage();
    logMemory('更新玩家头像', `key: ai-dnd-player-md, name: ${state.name}, avatar updated`);

    setPendingCharacter(null);
    setGeneratingAvatars(false);
  };

  // 跳过头像选择
  const clearAvatarSelection = async () => {
    setPendingCharacter(null);
    setGeneratingAvatars(false);

    const state = usePlayerStore.getState();
    writePlayerJsonToDB(state.name, state.gender ?? '', state.appearance ?? '', state.personality ?? '', state.backstory ?? '');
    savePlayerStatsToStorage();
  };

  // 核心 LLM 发送逻辑
  const sendToLLM = async (
    targetNpcId: string,
    targetNpcName: string,
    systemPrompt: string,
    userMessage: string,
    showUserMessage: boolean
  ) => {
    const apiKey = useSettingsStore.getState().getCurrentApiKey();
    const model = useSettingsStore.getState().getCurrentModel();
    const apiUrl = useSettingsStore.getState().getCurrentApiUrl();
    if (!apiKey) return;

    const currentPlayerIsCreated = usePlayerStore.getState().isCreated;

    // 获取当前 messages（用于构建 history）
    const state = useDialogueStore.getState();
    const currentMessages = state.npcMessages[targetNpcId] || [];
    const historyMessages: DialogueMessage[] = currentMessages.filter((m) => m.role !== 'system');

    if (showUserMessage) {
      setLoading(true);
      addMessage({ role: 'user', content: userMessage });
    } else {
      setLoadingForNpc(targetNpcId, true);
    }

    try {
      const history: ChatMessage[] = historyMessages.map((m) => ({
        role: m.role === 'npc' ? 'assistant' : m.role,
        content: m.content,
      }));

      const response = await chatWithNPC(
        targetNpcId === DM_NPC_ID ? 'DM' : targetNpcName,
        systemPrompt,
        history,
        userMessage,
        apiKey,
        model,
        apiUrl
      );
      addApiUsage(response.usage);
      let replyContent = response.content;

      if (targetNpcId === DM_NPC_ID) {
        const result = parseLLMJson(response.content);
        if (result.dialogue) {
          replyContent = result.dialogue.trim();
        } else if (result.error) {
          logError('DM JSON 响应解析失败', `${result.error}; 原始内容: ${response.content.slice(0, 500)}`);
        } else {
          logError('DM JSON 响应缺少 dialogue 字段', `原始内容: ${response.content.slice(0, 500)}`);
        }

        // 提取 options
        if (result.options) {
          setNpcOptions((prev) => ({ ...prev, [targetNpcId]: result.options! }));
        } else {
          setNpcOptions((prev) => {
            const next = { ...prev };
            delete next[targetNpcId];
            return next;
          });
        }

        if (!currentPlayerIsCreated && result.character) {
          const char = result.character as Record<string, unknown>;
          if (
            typeof char.name === 'string' &&
            typeof char.strength === 'number' &&
            typeof char.agility === 'number' &&
            typeof char.intelligence === 'number' &&
            typeof char.charisma === 'number'
          ) {
            const characterData: CharacterData = {
              name: char.name,
              strength: char.strength,
              agility: char.agility,
              intelligence: char.intelligence,
              charisma: char.charisma,
              gender: typeof char.gender === 'string' ? char.gender : undefined,
              appearance: typeof char.appearance === 'string' ? char.appearance : undefined,
              personality: typeof char.personality === 'string' ? char.personality : undefined,
              backstory: typeof char.backstory === 'string' ? char.backstory : undefined,
            };

            // 代码层校验：四维属性之和必须为 50
            const attrSum = characterData.strength + characterData.agility + characterData.intelligence + characterData.charisma;
            if (attrSum !== 50) {
              addMessageToNpc(targetNpcId, { role: 'assistant', content: replyContent });
              await sendToLLM(
                targetNpcId,
                targetNpcName,
                systemPrompt,
                `(系统提示：当前角色四维属性之和为${attrSum}，不等于50。请提示玩家修改属性分配，使力量、敏捷、智力、魅力之和恰好为50，每项仍须在8-16之间，然后重新给出角色预览等待玩家确认。)`,
                false
              );
              return;
            }

            // 属性校验通过，先创建角色并写入记忆，再进入头像生成流程
            addMessageToNpc(targetNpcId, { role: 'assistant', content: replyContent });
            writePlayerMemoryAndCreateCharacter(characterData);

            setPendingCharacter(characterData);
            setGeneratingAvatars(true);

            const { imageApiKey, imageModel } = useSettingsStore.getState();
            if (imageApiKey) {
              try {
                const prompt = buildPortraitPrompt(characterData);
                const res = await generateCharacterPortrait(prompt, imageApiKey, imageModel, IMAGE_API_URL, 1);
                if (res.urls[0]) {
                  await updatePlayerAvatar(res.urls[0]);
                } else {
                  clearAvatarSelection();
                }
              } catch (e) {
                logError('头像生成失败', e instanceof Error ? e.message : String(e));
                clearAvatarSelection();
              }
            } else {
              // 未配置图片 API，跳过头像生成
              clearAvatarSelection();
            }
            return;
          }
        }
      }

      addMessageToNpc(targetNpcId, { role: 'assistant', content: replyContent });
    } catch (error) {
      addMessageToNpc(targetNpcId, { role: 'assistant', content: '（对话出错...）' });
    } finally {
      setLoadingForNpc(targetNpcId, false);
    }
  };

  // 处理 LLM 对话输入
  const handleLLMSubmit = async () => {
    if (!userInput.trim()) return;

    const currentNpcId = store.npcId;
    const currentNpcName = store.npcName;
    const currentPlayerIsCreated = usePlayerStore.getState().isCreated;

    const systemPrompt =
      currentNpcId === DM_NPC_ID
        ? currentPlayerIsCreated
          ? DM_BASE_PROMPT
          : DM_CHARACTER_CREATION_PROMPT
        : `你是 DND 游戏中的${currentNpcName}。请用中世纪奇幻风格与玩家对话。`;

    await sendToLLM(currentNpcId, currentNpcName, systemPrompt, userInput.trim(), true);
    setUserInput('');
  };

  // 处理选项点击
  const handleOptionClick = async (text: string) => {
    const currentNpcId = store.npcId;
    const currentNpcName = store.npcName;
    const currentPlayerIsCreated = usePlayerStore.getState().isCreated;

    const systemPrompt =
      currentNpcId === DM_NPC_ID
        ? currentPlayerIsCreated
          ? DM_BASE_PROMPT
          : DM_CHARACTER_CREATION_PROMPT
        : `你是 DND 游戏中的${currentNpcName}。请用中世纪奇幻风格与玩家对话。`;

    // 清除当前选项，防止重复点击
    setNpcOptions((prev) => {
      const next = { ...prev };
      delete next[currentNpcId];
      return next;
    });

    await sendToLLM(currentNpcId, currentNpcName, systemPrompt, text, true);
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
                  {renderBoldText(msg.content)}
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
          <div className="space-y-2">
            {/* 头像生成中提示 */}
            {pendingCharacter && generatingAvatars && (
              <div className="text-gray-300 text-sm text-center py-2">
                正在根据角色设定生成头像，请稍候...
              </div>
            )}

            {/* 普通选项按钮 */}
            {!pendingCharacter && !isLoading && !generatingAvatars && (
              <div className="flex flex-wrap gap-2">
                {(npcOptions[activeTabId] || []).filter((opt) => !opt.includes('自定义')).length > 0 ? (
                  npcOptions[activeTabId]
                    .filter((opt) => !opt.includes('自定义'))
                    .map((opt, idx) => (
                      <button
                        key={idx}
                        className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1.5 rounded border border-gray-500"
                        onClick={() => handleOptionClick(opt)}
                      >
                        {opt}
                      </button>
                    ))
                ) : (
                  <button
                    className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-3 py-1.5 rounded border border-gray-500"
                    onClick={() => handleOptionClick('请给我一些决策选项')}
                  >
                    请给我一些决策选项
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-gray-600 text-white text-sm p-2 rounded border border-gray-500 focus:border-blue-400 outline-none disabled:opacity-50"
                placeholder="输入消息..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLLMSubmit()}
                disabled={isLoading || generatingAvatars || pendingCharacter !== null}
              />
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 rounded disabled:opacity-50"
                onClick={handleLLMSubmit}
                disabled={isLoading || !userInput.trim() || generatingAvatars || pendingCharacter !== null}
              >
                发送
              </button>
            </div>
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
