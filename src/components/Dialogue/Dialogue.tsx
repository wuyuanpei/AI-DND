import React, { useState, useEffect, useRef } from 'react';
import { useDialogueStore, getDMName, type DMPhase } from '../../store/dialogueStore';
import { useSettingsStore, IMAGE_API_URL } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { logError, logMemory } from '../../store/logStore';
import { savePlayerJson, saveAvatar, saveDMPhase, loadDMPhase, saveDialogueHistory, loadDialogueHistory } from '../../utils/playerDB';
import { savePlayerStatsToStorage } from '../../utils/playerStats';
import { DM_BASE_PROMPT, DM_CHARACTER_CREATION_PROMPT, DM_SHOP_PROMPT } from '../../config/dmConfig';
import { buildSystemPrompt } from '../../utils/dmPrompt';
import { chatWithNPC } from '../../services/qwen';
import { generateCharacterPortrait } from '../../services/imageGen';
import { buildPortraitPrompt } from '../../config/imageConfig';
import type { ChatMessage } from '../../services/qwen';
import type { DialogueMessage } from '../../types';
import type { CharacterData } from '../../store/playerStore';
import { parseLLMJson } from '../../utils/parseLLMJson';

const getBasePromptForDM = (phase: DMPhase): string => {
  switch (phase) {
    case 'creation': return DM_CHARACTER_CREATION_PROMPT;
    case 'shop': return DM_SHOP_PROMPT;
    case 'adventure': return DM_BASE_PROMPT;
    default: return DM_BASE_PROMPT;
  }
};

const getSystemPromptForDM = (phase: DMPhase): string => {
  const base = getBasePromptForDM(phase);
  if (phase === 'creation') {
    return base;
  }
  return buildSystemPrompt(base);
};

const dmPhaseToHistoryKey = (phase: DMPhase): string => {
  return phase === 'shop' ? 'shopping' : phase;
};

const writePlayerJsonToDB = (name: string, gender: string, appearance: string, personality: string, backstory: string) => {
  void savePlayerJson({ name, gender, appearance, personality, backstory }).catch((e) => logError('保存玩家文本到 IndexedDB 失败', e instanceof Error ? e.message : String(e)));
};

const DM_NPC_ID = '__dm__';

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
    openLLMDialogue,
  } = store;

  const { addApiUsage } = useSettingsStore();
  const createCharacter = usePlayerStore((state) => state.createCharacter);
  const [userInput, setUserInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [pendingCharacter, setPendingCharacter] = useState<CharacterData | null>(null);
  const [generatingAvatars, setGeneratingAvatars] = useState(false);
  const [restored, setRestored] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dmName = getDMName(store.dmPhase);

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

  // 页面首次加载时从 IndexedDB 恢复 dmPhase 和当前阶段对话历史
  useEffect(() => {
    (async () => {
      const savedPhase = await loadDMPhase();
      const phase: DMPhase = (savedPhase as DMPhase) || 'creation';
      const historyKey = dmPhaseToHistoryKey(phase);
      const history = await loadDialogueHistory(historyKey);

      useDialogueStore.setState({ dmPhase: phase });
      if (history && history.length > 0) {
        useDialogueStore.setState({ messages: history });
      }
      setRestored(true);
    })();
  }, []);

  // 初始化时自动打开 DM 对话
  useEffect(() => {
    if (!restored || isOpen) return;
    const prompt = getSystemPromptForDM(store.dmPhase);
    openLLMDialogue(DM_NPC_ID, dmName, prompt);
  }, [restored, isOpen, openLLMDialogue, store.dmPhase, dmName]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // DM 自动发起首轮对话（角色创建问候或游戏开场）
  useEffect(() => {
    if (!restored) return;
    if (
      isOpen &&
      !isLoading &&
      messages.filter((m) => m.role !== 'system').length === 0
    ) {
      const systemPrompt = getSystemPromptForDM(store.dmPhase);
      sendToLLM(systemPrompt, '（玩家刚刚进入游戏，请主动向玩家打招呼并开启对话。）', false);
    }
  }, [restored, isOpen, isLoading, messages, store.dmPhase]);

  // 每当 DM 对话内容变化时，持久化当前阶段的对话历史（只保存可见的 assistant/user 消息）
  useEffect(() => {
    if (!restored) return;
    const key = dmPhaseToHistoryKey(store.dmPhase);
    const visibleMessages = messages.filter((m) => m.role !== 'system');
    void saveDialogueHistory(key, visibleMessages).catch(() => {});
  }, [restored, store.dmPhase, messages]);

  // 获取当前对话节点
  const currentNode = nodes.find((n) => n.id === currentNodeId);

  // 创建角色并写入记忆（不带头像，头像后续单独更新）
  const writePlayerMemoryAndCreateCharacter = (character: CharacterData) => {
    createCharacter(character);
    writePlayerJsonToDB(character.name, character.gender ?? '', character.appearance ?? '', character.personality ?? '', character.backstory ?? '');
    savePlayerStatsToStorage();
    logMemory('写入玩家记忆卡片', `IndexedDB: playerJson, name: ${character.name}`);
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
    logMemory('更新玩家头像', `IndexedDB: avatar, name: ${state.name}, avatar updated`);

    setPendingCharacter(null);
    setGeneratingAvatars(false);

    // 进入商店阶段，清空历史并主动打招呼
    useDialogueStore.setState({ dmPhase: 'shop', messages: [] });
    void saveDMPhase('shop').catch(() => {});
    await sendToLLM(
      getSystemPromptForDM('shop'),
      '（玩家刚刚创建完角色并进入商店，请主动向玩家打招呼并开启对话。）',
      false
    );
  };

  // 跳过头像选择
  const clearAvatarSelection = async () => {
    setPendingCharacter(null);
    setGeneratingAvatars(false);

    const state = usePlayerStore.getState();
    writePlayerJsonToDB(state.name, state.gender ?? '', state.appearance ?? '', state.personality ?? '', state.backstory ?? '');
    savePlayerStatsToStorage();

    // 进入商店阶段，清空历史并主动打招呼
    useDialogueStore.setState({ dmPhase: 'shop', messages: [] });
    void saveDMPhase('shop').catch(() => {});
    await sendToLLM(
      getSystemPromptForDM('shop'),
      '（玩家刚刚创建完角色并进入商店，请主动向玩家打招呼并开启对话。）',
      false
    );
  };

  // 核心 LLM 发送逻辑
  const sendToLLM = async (
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
    const historyMessages: DialogueMessage[] = useDialogueStore.getState().messages.filter((m) => m.role !== 'system');

    if (showUserMessage) {
      setLoading(true);
      addMessage({ role: 'user', content: userMessage });
    } else {
      setLoading(true);
    }

    try {
      const history: ChatMessage[] = historyMessages.map((m) => ({
        role: m.role === 'npc' ? 'assistant' : m.role,
        content: m.content,
      }));

      const response = await chatWithNPC(
        'DM',
        systemPrompt,
        history,
        userMessage,
        apiKey,
        model,
        apiUrl
      );
      addApiUsage(response.usage);
      let replyContent = response.content;

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
        setOptions(result.options);
      } else {
        setOptions([]);
      }

      // 商店阶段 → 冒险阶段
      const dmPhase = useDialogueStore.getState().dmPhase;
      if (dmPhase === 'shop' && result.startAdventure) {
        addMessage({ role: 'assistant', content: replyContent });

        useDialogueStore.setState({ dmPhase: 'adventure', messages: [] });
        void saveDMPhase('adventure').catch(() => {});

        await sendToLLM(
          getSystemPromptForDM('adventure'),
          '（玩家已完成购物准备开始冒险，请主动向玩家打招呼并开启新的冒险旅程。）',
          false
        );
        return;
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
            addMessage({ role: 'assistant', content: replyContent });
            await sendToLLM(
              systemPrompt,
              `(系统提示：当前角色四维属性之和为${attrSum}，不等于50。请提示玩家修改属性分配，使力量、敏捷、智力、魅力之和恰好为50，每项仍须在8-16之间，然后重新给出角色预览等待玩家确认。)`,
              false
            );
            return;
          }

          // 属性校验通过，先创建角色并写入记忆，再进入头像生成流程
          addMessage({ role: 'assistant', content: replyContent });
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

      addMessage({ role: 'assistant', content: replyContent });
    } catch (error) {
      addMessage({ role: 'assistant', content: '（对话出错...）' });
    } finally {
      setLoading(false);
    }
  };

  // 处理 LLM 对话输入
  const handleLLMSubmit = async () => {
    if (!userInput.trim()) return;
    const systemPrompt = getSystemPromptForDM(store.dmPhase);
    await sendToLLM(systemPrompt, userInput.trim(), true);
    setUserInput('');
  };

  // 处理选项点击
  const handleOptionClick = async (text: string) => {
    const systemPrompt = getSystemPromptForDM(store.dmPhase);
    // 清除当前选项，防止重复点击
    setOptions([]);
    await sendToLLM(systemPrompt, text, true);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden min-w-0">
      {/* DM 名称栏 */}
      <div className="flex-shrink-0 border-b border-gray-600 pb-2 mb-2">
        <div className="flex items-center">
          <span className="px-3 py-1.5 rounded text-sm bg-yellow-600 text-white">
            {dmName}
          </span>
        </div>
      </div>

      {/* 对话内容 - 可滚动区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden mb-3 text-white text-base min-h-0">
        {/* 脚本模式：显示当前节点文本 */}
        {mode === 'scripted' && currentNode && (
          <div className="bg-gray-600 rounded p-3 mb-3 break-words whitespace-pre-wrap">
            {currentNode.text}
          </div>
        )}

        {/* LLM 模式：显示对话历史 */}
        {mode === 'llm' && (
          <div className="space-y-3">
            {messages
              .filter((m) => m.role !== 'system')
              .map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg max-w-[85%] break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 ml-auto'
                      : 'bg-gray-600 mr-auto'
                  }`}
                >
                  {renderBoldText(msg.content)}
                </div>
              ))}
            {isLoading && (
              <div className="text-gray-400 text-center text-base">思考中...</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 选项/输入区域 */}
      <div className="flex-shrink-0">
        {/* 脚本模式：显示选项 */}
        {mode === 'scripted' && currentNode?.choices && (
          <div className="space-y-2">
            {currentNode.choices.map((choice, idx) => (
              <button
                key={idx}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white text-sm p-3 rounded text-left"
                onClick={() => selectChoice(idx)}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}

        {/* LLM 模式：输入框 */}
        {mode === 'llm' && (
          <div className="space-y-3">
            {/* 头像生成中提示 */}
            {pendingCharacter && generatingAvatars && (
              <div className="text-gray-300 text-base text-center py-2">
                正在根据角色设定生成头像，请稍候...
              </div>
            )}

            {/* 普通选项按钮 */}
            {!pendingCharacter && !isLoading && !generatingAvatars && (
              <div className="flex flex-wrap gap-2">
                {options.filter((opt) => !opt.includes('自定义')).length > 0 ? (
                  options
                    .filter((opt) => !opt.includes('自定义'))
                    .map((opt, idx) => (
                      <button
                        key={idx}
                        className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-4 py-2 rounded border border-gray-500"
                        onClick={() => handleOptionClick(opt)}
                      >
                        {opt}
                      </button>
                    ))
                ) : (
                  <button
                    className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-4 py-2 rounded border border-gray-500"
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
                className="flex-1 bg-gray-600 text-white text-base p-3 rounded border border-gray-500 focus:border-blue-400 outline-none disabled:opacity-50"
                placeholder="输入消息..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLLMSubmit()}
                disabled={isLoading || generatingAvatars || pendingCharacter !== null}
              />
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-base px-5 rounded disabled:opacity-50"
                onClick={handleLLMSubmit}
                disabled={isLoading || !userInput.trim() || generatingAvatars || pendingCharacter !== null}
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialogue;
