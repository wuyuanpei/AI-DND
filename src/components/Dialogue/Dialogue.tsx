import React, { useState, useEffect, useRef } from 'react';
import { useDialogueStore, getDMName, type DMPhase } from '../../store/dialogueStore';
import { useSettingsStore, IMAGE_API_URL } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { logError, logMemory } from '../../store/logStore';
import { savePlayerJson, saveAvatar, saveDMPhase, loadDMPhase, saveDialogueHistory, loadDialogueHistory, saveShopWeaponIds, loadShopWeaponIds, savePurchasedWeaponIds, loadPurchasedWeaponIds } from '../../utils/playerDB';
import { savePlayerStatsToStorage } from '../../utils/playerStats';
import { DM_BASE_PROMPT, DM_CHARACTER_CREATION_PROMPT, DM_SHOP_PROMPT, buildShopSystemPrompt } from '../../config/dmConfig';
import { buildSystemPrompt } from '../../utils/dmPrompt';
import { chatWithNPC } from '../../services/qwen';
import { generateCharacterPortrait } from '../../services/imageGen';
import { buildPortraitPrompt } from '../../config/imageConfig';
import type { ChatMessage } from '../../services/qwen';
import type { DialogueMessage, Item } from '../../types';
import type { CharacterData } from '../../store/playerStore';
import { parseLLMJson } from '../../utils/parseLLMJson';
import weaponsData from '../../data/weapons.json';

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

const getShopSystemPrompt = (shopWeapons: Array<Record<string, unknown>>): string => {
  const weapons = shopWeapons.map((w) => ({
    id: w.id as string,
    name: w.name as string,
    weaponType: w.weaponType as 'melee' | 'ranged',
    description: w.description as string,
    rarity: w.rarity as string,
    damage: w.damage as string,
    durability: w.durability as number,
    price: w.price as number,
    effect: w.effect as string | undefined,
    icon: w.icon as string,
  }));
  return buildSystemPrompt(buildShopSystemPrompt(weapons));
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

  // 商店阶段：初始化随机武器（优先从 IndexedDB 恢复 ID，再从 weapons.json 构建完整数据）
  useEffect(() => {
    if (store.dmPhase !== 'shop' || store.shopWeapons.length > 0) return;
    (async () => {
      const allWeapons = (weaponsData as { weapons: Array<Record<string, unknown>> }).weapons;
      const savedIds = await loadShopWeaponIds();
      if (savedIds && savedIds.length === 9) {
        const idSet = new Set(savedIds);
        const restored = allWeapons.filter((w) => idSet.has(w.id));
        if (restored.length === 9) {
          const purchasedIds = new Set((await loadPurchasedWeaponIds()) ?? []);
          useDialogueStore.setState({ shopWeapons: restored, selectedWeaponIds: new Set(), purchasedWeaponIds: purchasedIds });
          return;
        }
      }

      const commonWeapons = allWeapons.filter((w) => w.rarity === 'common');

      const melee = commonWeapons.filter((w) => w.weaponType === 'melee');
      const ranged = commonWeapons.filter((w) => w.weaponType === 'ranged');

      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const selected = [...shuffle(melee).slice(0, 6), ...shuffle(ranged).slice(0, 3)];
      useDialogueStore.setState({ shopWeapons: selected, selectedWeaponIds: new Set(), purchasedWeaponIds: new Set() });
      void saveShopWeaponIds(selected.map((w) => w.id)).catch(() => {});
      void savePurchasedWeaponIds([]).catch(() => {});
    })();
  }, [store.dmPhase, store.shopWeapons.length]);

  // DM 自动发起首轮对话（角色创建问候或游戏开场）
  useEffect(() => {
    if (!restored) return;
    if (store.dmPhase === 'shop') return; // 商店阶段由专用 useEffect 处理
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

    // 进入商店阶段，清空历史（武器初始化和问候由下方 useEffect 处理）
    useDialogueStore.setState({ dmPhase: 'shop', messages: [] });
    void saveDMPhase('shop').catch(() => {});
  };

  // 跳过头像选择
  const clearAvatarSelection = async () => {
    setPendingCharacter(null);
    setGeneratingAvatars(false);

    const state = usePlayerStore.getState();
    writePlayerJsonToDB(state.name, state.gender ?? '', state.appearance ?? '', state.personality ?? '', state.backstory ?? '');
    savePlayerStatsToStorage();

    // 进入商店阶段，清空历史（武器初始化和问候由下方 useEffect 处理）
    useDialogueStore.setState({ dmPhase: 'shop', messages: [] });
    void saveDMPhase('shop').catch(() => {});
  };

  // 商店武器初始化后，自动发送问候
  useEffect(() => {
    if (store.dmPhase !== 'shop' || store.shopWeapons.length === 0) return;
    if (!restored || isOpen === false) return;
    if (messages.filter((m) => m.role !== 'system').length > 0) return;
    const shopPrompt = getShopSystemPrompt(store.shopWeapons);
    sendToLLM(shopPrompt, '（玩家刚刚创建完角色并进入商店，请主动向玩家打招呼并开启对话。）', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.dmPhase, store.shopWeapons.length, restored, isOpen]);

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

        useDialogueStore.setState({ dmPhase: 'adventure', messages: [], shopWeapons: [], selectedWeaponIds: new Set(), purchasedWeaponIds: new Set() });
        void saveDMPhase('adventure').catch(() => {});
        void saveShopWeaponIds([]).catch(() => {});

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

    const systemPrompt = store.dmPhase === 'shop'
      ? getShopSystemPrompt(store.shopWeapons)
      : getSystemPromptForDM(store.dmPhase);
    await sendToLLM(systemPrompt, userInput.trim(), true);
    setUserInput('');
  };

  // 处理选项点击
  const handleOptionClick = async (text: string) => {
    const systemPrompt = store.dmPhase === 'shop'
      ? getShopSystemPrompt(store.shopWeapons)
      : getSystemPromptForDM(store.dmPhase);
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
            {/* 商店阶段：武器选择面板 */}
            {store.dmPhase === 'shop' && store.shopWeapons.length > 0 && (
              <div>
                <div className="text-yellow-400 text-sm font-semibold mb-2">
                  装备货架 — 选中后点击购买
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {store.shopWeapons.map((weapon) => {
                    const gold = usePlayerStore.getState().gold;
                    const isSelected = store.selectedWeaponIds.has(weapon.id);
                    const isPurchased = store.purchasedWeaponIds.has(weapon.id);
                    const selectedTotal = Array.from(store.selectedWeaponIds)
                      .filter((id) => id !== weapon.id)
                      .reduce((sum, id) => {
                        const w = store.shopWeapons.find((x) => x.id === id);
                        return sum + (w?.price ?? 0);
                      }, 0);
                    const canAfford = !isPurchased && gold >= selectedTotal + weapon.price;
                    const isDisabled = isPurchased || !canAfford;
                    return (
                      <div
                        key={weapon.id}
                        className={`rounded-lg p-1.5 text-xs transition-all border ${
                          isSelected
                            ? 'border-blue-400 bg-blue-900/50 cursor-pointer'
                            : isDisabled
                              ? 'border-gray-600 bg-gray-800 opacity-50 cursor-not-allowed pointer-events-none'
                              : 'border-gray-500 bg-gray-700 hover:border-gray-400 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isDisabled) return;
                          const ids = new Set(useDialogueStore.getState().selectedWeaponIds);
                          if (ids.has(weapon.id)) ids.delete(weapon.id);
                          else ids.add(weapon.id);
                          useDialogueStore.setState({ selectedWeaponIds: ids });
                        }}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img src={`/${weapon.icon}`} alt={weapon.name} className="w-5 h-5 object-contain" />
                            <span className="text-white font-semibold truncate">{weapon.name}</span>
                          </div>
                          <span className="text-yellow-300 text-[11px] flex-shrink-0">{weapon.price} 金</span>
                        </div>
                        <div className="text-gray-300 text-[11px]">伤害: {weapon.damage}        持久度: {weapon.durability}</div>
                        <div className="text-gray-400 mt-0.5 leading-tight line-clamp-2" style={{ fontSize: '10px' }}>{weapon.description}</div>
                        {isPurchased && (
                          <div className="text-green-400 text-[11px] font-semibold">已购买</div>
                        )}
                        {isSelected && !isPurchased && (
                          <div className="text-blue-300 text-[11px] font-semibold">已选中</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 购买按钮 */}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                      store.selectedWeaponIds.size > 0
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={store.selectedWeaponIds.size === 0}
                    onClick={() => {
                      const totalPrice = Array.from(store.selectedWeaponIds).reduce((sum, id) => {
                        const w = store.shopWeapons.find((x) => x.id === id);
                        return sum + (w?.price ?? 0);
                      }, 0);
                      const currentGold = usePlayerStore.getState().gold;

                      if (currentGold < totalPrice) return;

                      const deductGold = usePlayerStore.getState().deductGold;
                      const addItem = usePlayerStore.getState().addItem;
                      const purchaseNames: string[] = [];

                      for (const weaponId of store.selectedWeaponIds) {
                        const preset = store.shopWeapons.find((w) => w.id === weaponId);
                        if (!preset) continue;
                        purchaseNames.push(preset.name);
                        const item: Item = {
                          id: preset.id,
                          name: preset.name,
                          type: preset.weaponType === 'melee' ? 'mainWeapon' : 'ranged',
                          description: preset.description,
                          rarity: preset.rarity,
                          weaponType: preset.weaponType,
                          damage: preset.damage,
                          icon: preset.icon,
                          price: preset.price,
                          effect: preset.effect,
                          durability: preset.durability,
                          maxDurability: preset.durability,
                        };
                        addItem(item);
                      }

                      deductGold(totalPrice);
                      const newPurchased = new Set(useDialogueStore.getState().purchasedWeaponIds);
                      store.selectedWeaponIds.forEach((id) => newPurchased.add(id));
                      useDialogueStore.setState({ selectedWeaponIds: new Set(), purchasedWeaponIds: newPurchased });
                      void savePurchasedWeaponIds(Array.from(newPurchased)).catch(() => {});
                      savePlayerStatsToStorage();

                      const systemPrompt = getShopSystemPrompt(store.shopWeapons);
                      const userMessage = `（我购买了 ${purchaseNames.join('、')}，共花费 ${totalPrice} 金币）`;
                      void sendToLLM(systemPrompt, userMessage, true);
                    }}
                  >
                    购买 {store.selectedWeaponIds.size > 0 ? `（${Array.from(store.selectedWeaponIds).reduce((sum, id) => {
                      const w = store.shopWeapons.find((x) => x.id === id);
                      return sum + (w?.price ?? 0);
                    }, 0)} 金币）` : ''}
                  </button>
                  {store.selectedWeaponIds.size > 0 && (
                    <span className="text-gray-400 text-xs">
                      已选 {store.selectedWeaponIds.size} 件
                    </span>
                  )}
                </div>
              </div>
            )}

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
