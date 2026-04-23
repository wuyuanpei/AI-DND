import React, { useState, useEffect, useRef } from 'react';
import { useDialogueStore, getDMName, type DMPhase } from '../../store/dialogueStore';
import { useSettingsStore, IMAGE_API_URL } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { logError, logMemory } from '../../store/logStore';
import { savePlayerJson, saveAvatar, saveDMPhase, loadDMPhase, saveDialogueHistory, loadDialogueHistory, saveShopWeaponIds, loadShopWeaponIds, savePurchasedWeaponIds, loadPurchasedWeaponIds, saveShopArmorIds, loadShopArmorIds, savePurchasedArmorIds, loadPurchasedArmorIds, clearShopData, generateCombatHistoryKey, saveCombatState } from '../../utils/playerDB';
import { savePlayerStatsToStorage } from '../../utils/playerStats';
import { DM_BASE_PROMPT, DM_CHARACTER_CREATION_PROMPT, DM_SHOP_PROMPT, buildShopSystemPrompt } from '../../config/dmConfig';
import { buildSystemPrompt, buildPlayerContextMessage } from '../../utils/dmPrompt';
import { getAvailableMonsters, validateAttackPayload } from '../../utils/monsterUtils';
import { buildCombatSystemPrompt } from '../../config/combatConfig';
import monstersData from '../../data/monsters.json';
import { chatWithNPC } from '../../services/qwen';
import { generateCharacterPortrait } from '../../services/imageGen';
import { buildPortraitPrompt } from '../../config/imageConfig';
import type { ChatMessage } from '../../services/qwen';
import type { DialogueMessage, Item } from '../../types';
import type { CharacterData } from '../../store/playerStore';
import { parseLLMJson } from '../../utils/parseLLMJson';
import {
  type CombatMonsterState,
  type CombatAction,
  type AttackResult,
  resolvePlayerAttack,
  resolveMonsterAttack,
  buildPlayerAttackResolutionMessage,
  buildMonsterAttackResolutionMessage,
  getDamageBySkillId,
} from '../../utils/combatEngine';
import weaponsData from '../../data/weapons.json';
import armorsData from '../../data/armors.json';

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
  return buildSystemPrompt(base, phase);
};

const getCombatSystemPromptForAttack = (attack: { monsters: Array<{ id: string; x: number; y: number }>; environment?: string; battleBackground?: string }): string => {
  const monsters = attack.monsters
    .map(m => (monstersData as { monsters: Array<{ id: string; name: string; hp: number; defense: number; strength: number; agility: number; intelligence: number; charisma: number; expReward: number; skills: Array<{ name: string; rangeType: string; damage: string }> }> }).monsters.find(mo => mo.id === m.id))
    .filter(Boolean);
  return buildCombatSystemPrompt(monsters as Parameters<typeof buildCombatSystemPrompt>[0], attack);
};

// 从 attack payload 构建战斗怪物状态
const buildCombatMonsters = (attack: { monsters: Array<{ id: string; x: number; y: number }> }): CombatMonsterState[] => {
  const idCounts = new Map<string, number>();
  return attack.monsters.map((am) => {
    const count = idCounts.get(am.id) ?? 0;
    idCounts.set(am.id, count + 1);
    const uniqueId = `${am.id}_${count + 1}`;
    const m = (monstersData as { monsters: Array<{ id: string; name: string; hp: number; defense: number; strength: number; agility: number; skills: Array<{ name: string; rangeType: string; damage: string }> }> }).monsters.find(mo => mo.id === am.id);
    return {
      uniqueId,
      prototypeId: am.id,
      name: m?.name ?? '未知怪物',
      currentHp: m?.hp ?? 10,
      maxHp: m?.hp ?? 10,
      defense: m?.defense ?? 10,
      strength: m?.strength ?? 10,
      agility: m?.agility ?? 10,
      skills: m?.skills ?? [],
      x: am.x,
      y: am.y,
    };
  });
};

// 获取当前战斗状态文本，追加到消息末尾
const getCombatStatusAppendix = (): string => {
  const state = useDialogueStore.getState();
  if (state.dmPhase !== 'combat' || state.combatMonsters.length === 0) return '';
  const { combatRound, combatTurn, combatMonsters, combatMonsterIndex } = state;

  let turnText: string;
  if (combatTurn === 'player') {
    turnText = '玩家回合';
  } else {
    const actingMonster = combatMonsters[combatMonsterIndex];
    turnText = actingMonster ? `${actingMonster.name}（${actingMonster.uniqueId}）回合` : '怪物回合';
  }

  const playerState = usePlayerStore.getState();
  const playerStatus = `玩家 HP：${playerState.hp} / ${playerState.maxHp}，防御：${playerState.defense}`;

  const monsterStatus = combatMonsters
    .map(m => `- ${m.name}（${m.uniqueId}）: HP ${m.currentHp}/${m.maxHp}, 防御 ${m.defense}, 力量 ${m.strength}, 敏捷 ${m.agility}, 坐标 (${m.x}, ${m.y})\n  技能: ${m.skills.map(s => `${s.name}(${s.rangeType}, ${s.damage})`).join('、')}`)
    .join('\n');

  return `【战斗状态】第 ${combatRound} 回合 — ${turnText}\n${playerStatus}\n怪物状态：\n${monsterStatus}`;
};

// 解析并执行战斗行动
const executeCombatAction = (action: CombatAction, isPlayerTurn: boolean, actingMonsterId?: string): { message: string; combatEnded: boolean; outcome?: 'victory' | 'defeat' } => {
  const playerState = usePlayerStore.getState();
  const dialogueState = useDialogueStore.getState();
  const monsters = [...dialogueState.combatMonsters];

  if (isPlayerTurn) {
    // 玩家回合：只有攻击
    const skillDamage = getDamageBySkillId(playerState.skills, action.method);
    const result = resolvePlayerAttack(
      action,
      playerState.strength,
      playerState.agility,
      monsters,
      skillDamage
    );
    // 更新怪物状态
    useDialogueStore.setState({ combatMonsters: monsters });

    const resolutionMsg = buildPlayerAttackResolutionMessage(result, action);

    // 检查是否所有怪物死亡
    const allDead = monsters.every(m => m.currentHp <= 0);
    if (allDead) {
      return { message: resolutionMsg, combatEnded: true, outcome: 'victory' };
    }
    return { message: resolutionMsg, combatEnded: false };
  } else {
    // 怪物回合
    const monsterId = actingMonsterId || action.monster || '';
    const monsterAction: CombatAction = {
      ...action,
      monster: monsterId,
    };
    const result = resolveMonsterAttack(
      monsterAction,
      monsters
    );

    // 更新玩家 HP
    if (result.hit) {
      const newHp = Math.max(0, playerState.hp - result.damage);
      usePlayerStore.setState({ hp: newHp });
      savePlayerStatsToStorage();
    }

    const resolutionMsg = buildMonsterAttackResolutionMessage(result, action);

    // 检查玩家是否死亡
    const currentHp = usePlayerStore.getState().hp;
    if (currentHp <= 0) {
      return { message: resolutionMsg, combatEnded: true, outcome: 'defeat' };
    }
    return { message: resolutionMsg, combatEnded: false };
  }
};

const getShopSystemPrompt = (shopWeapons: Array<Record<string, unknown>>, shopArmors: Array<Record<string, unknown>>, purchasedWeaponIds: Set<string>, purchasedArmorIds: Set<string>): string => {
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
  const armors = shopArmors.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    armorType: a.armorType as 'helmet' | 'chest' | 'shield',
    description: a.description as string,
    rarity: a.rarity as string,
    defense: a.defense as number | undefined,
    damageReduction: a.damageReduction as number | undefined,
    bonusHp: a.bonusHp as number | undefined,
    durability: a.durability as number,
    price: a.price as number,
    effect: a.effect as string | undefined,
    icon: a.icon as string,
  }));
  return buildSystemPrompt(buildShopSystemPrompt(weapons, armors, purchasedWeaponIds, purchasedArmorIds));
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

      if (phase === 'combat') {
        // 战斗中刷新页面：尝试恢复战斗状态
        const savedKey = localStorage.getItem('combat_history_key');
        const preCombat = localStorage.getItem('pre_combat_messages');
        const pendingCombatResult = localStorage.getItem('pending_combat_result');
        const savedAttackPayload = localStorage.getItem('combat_attack_payload');
        const attackPayload = savedAttackPayload ? JSON.parse(savedAttackPayload) : null;
        const savedMonsters = localStorage.getItem('combat_monsters');
        const savedTurn = localStorage.getItem('combat_turn') as 'player' | 'monster' | null;
        const savedRound = localStorage.getItem('combat_round');
        const savedMonsterIndex = localStorage.getItem('combat_monster_index');
        if (savedKey && preCombat) {
          const combatHistory = await loadDialogueHistory(savedKey);
          useDialogueStore.setState({
            dmPhase: 'combat',
            combatHistoryKey: savedKey,
            preCombatMessages: JSON.parse(preCombat),
            messages: combatHistory ?? [],
            pendingCombatResult: pendingCombatResult ? JSON.parse(pendingCombatResult) : null,
            combatAttackPayload: attackPayload,
            combatMonsterIds: attackPayload ? attackPayload.monsters.map((m: { id: string }) => m.id) : [],
            combatMonsters: savedMonsters ? JSON.parse(savedMonsters) : [],
            combatTurn: savedTurn ?? 'player',
            combatRound: savedRound ? parseInt(savedRound, 10) : 1,
            combatMonsterIndex: savedMonsterIndex ? parseInt(savedMonsterIndex, 10) : 0,
          });
          if (combatHistory && combatHistory.length > 0) {
            for (let i = combatHistory.length - 1; i >= 0; i--) {
              const msg = combatHistory[i];
              if (msg.role === 'assistant' && msg.rawJson) {
                const parsed = parseLLMJson(msg.rawJson);
                if (parsed.options) {
                  setOptions(parsed.options);
                }
                break;
              }
            }
          }
        } else {
          // 战斗状态丢失，回退到冒险阶段
          useDialogueStore.setState({ dmPhase: 'adventure' });
          const history = await loadDialogueHistory('adventure');
          if (history && history.length > 0) {
            useDialogueStore.setState({ messages: history });
          }
        }
      } else {
        const historyKey = dmPhaseToHistoryKey(phase);
        const history = await loadDialogueHistory(historyKey);
        useDialogueStore.setState({ dmPhase: phase });
        if (history && history.length > 0) {
          useDialogueStore.setState({ messages: history });
          // 恢复最后一个 assistant 消息的 options
          for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (msg.role === 'assistant' && msg.rawJson) {
              const parsed = parseLLMJson(msg.rawJson);
              if (parsed.options) {
                setOptions(parsed.options);
              }
              break;
            }
          }
        }
        // 冒险阶段：恢复 pendingAttack
        if (phase === 'adventure') {
          const pendingAttack = localStorage.getItem('pending_attack');
          if (pendingAttack) {
            useDialogueStore.setState({ pendingAttack: JSON.parse(pendingAttack) });
          }
        }
      }
      setRestored(true);
    })();
  }, []);

  // 初始化时自动打开 DM 对话
  useEffect(() => {
    if (!restored || isOpen) return;
    if (store.dmPhase === 'combat' && store.combatAttackPayload) {
      const prompt = getCombatSystemPromptForAttack(store.combatAttackPayload);
      openLLMDialogue(DM_NPC_ID, dmName, prompt);
    } else {
      const prompt = getSystemPromptForDM(store.dmPhase);
      openLLMDialogue(DM_NPC_ID, dmName, prompt);
    }
  }, [restored, isOpen, openLLMDialogue, store.dmPhase, dmName, store.combatAttackPayload]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 商店阶段：初始化随机武器和防具（优先从 IndexedDB 恢复 ID，再从 JSON 构建完整数据）
  useEffect(() => {
    if (store.dmPhase !== 'shop' || (store.shopWeapons.length > 0 && store.shopArmors.length > 0)) return;
    (async () => {
      const allWeapons = (weaponsData as { weapons: Array<Record<string, unknown>> }).weapons;
      const allArmors = (armorsData as { armors: Array<Record<string, unknown>> }).armors;

      // 恢复武器
      const savedWeaponIds = await loadShopWeaponIds();
      let restoredWeapons: Array<Record<string, unknown>> = [];
      if (savedWeaponIds && savedWeaponIds.length === 9) {
        const idSet = new Set(savedWeaponIds);
        restoredWeapons = allWeapons.filter((w) => idSet.has(w.id));
        if (restoredWeapons.length === 9) {
          // 武器恢复成功
        }
      }

      if (restoredWeapons.length === 0) {
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
        restoredWeapons = [...shuffle(melee).slice(0, 6), ...shuffle(ranged).slice(0, 3)];
        void saveShopWeaponIds(restoredWeapons.map((w) => w.id)).catch(() => {});
      }

      // 恢复/生成防具 (3 头盔 + 3 护甲 + 3 盾牌)
      const commonArmors = allArmors.filter((a) => a.rarity === 'common');
      const helmets = commonArmors.filter((a) => a.armorType === 'helmet');
      const chests = commonArmors.filter((a) => a.armorType === 'chest');
      const shields = commonArmors.filter((a) => a.armorType === 'shield');
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const savedArmorIds = await loadShopArmorIds();
      let restoredArmors: Array<Record<string, unknown>> = [];
      if (savedArmorIds && savedArmorIds.length === 9) {
        const armorIdSet = new Set(savedArmorIds);
        restoredArmors = allArmors.filter((a) => armorIdSet.has(a.id));
      }
      if (restoredArmors.length === 9) {
        // 防具恢复成功
      } else {
        restoredArmors = [...shuffle(helmets).slice(0, 3), ...shuffle(chests).slice(0, 3), ...shuffle(shields).slice(0, 3)];
        void saveShopArmorIds(restoredArmors.map((a) => a.id)).catch(() => {});
      }
      const selectedArmors = restoredArmors;

      // 恢复已购买 ID
      const savedPurchasedWeaponIds = new Set((await loadPurchasedWeaponIds()) ?? []);
      const savedPurchasedArmorIds = new Set((await loadPurchasedArmorIds()) ?? []);

      useDialogueStore.setState({
        shopWeapons: restoredWeapons,
        shopArmors: selectedArmors,
        selectedWeaponIds: new Set(),
        selectedArmorIds: new Set(),
        purchasedWeaponIds: savedPurchasedWeaponIds,
        purchasedArmorIds: savedPurchasedArmorIds,
      });
    })();
  }, [store.dmPhase, store.shopWeapons.length, store.shopArmors.length]);

  // DM 自动发起首轮对话（角色创建问候或游戏开场）
  useEffect(() => {
    if (!restored) return;
    if (store.dmPhase === 'shop') return; // 商店阶段由专用 useEffect 处理
    if (store.dmPhase === 'combat') return; // 战斗阶段由初始化 useEffect 处理
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
    const visibleMessages = messages.filter((m) => m.role !== 'system');
    if (store.dmPhase === 'combat' && store.combatHistoryKey) {
      void saveCombatState(store.combatHistoryKey, visibleMessages).catch(() => {});
    } else {
      const key = dmPhaseToHistoryKey(store.dmPhase);
      void saveDialogueHistory(key, visibleMessages).catch(() => {});
    }
  }, [restored, store.dmPhase, store.combatHistoryKey, messages]);

  // 战斗状态变化时持久化到 localStorage
  useEffect(() => {
    if (store.dmPhase !== 'combat') return;
    localStorage.setItem('combat_monsters', JSON.stringify(store.combatMonsters));
    localStorage.setItem('combat_turn', store.combatTurn);
    localStorage.setItem('combat_round', String(store.combatRound));
    localStorage.setItem('combat_monster_index', String(store.combatMonsterIndex));
  }, [store.dmPhase, store.combatMonsters, store.combatTurn, store.combatRound, store.combatMonsterIndex]);

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

  // 商店武器和防具初始化后，自动发送问候
  useEffect(() => {
    if (store.dmPhase !== 'shop' || store.shopWeapons.length === 0 || store.shopArmors.length === 0) return;
    if (!restored || isOpen === false) return;
    if (messages.filter((m) => m.role !== 'system').length > 0) return;
    const shopPrompt = getShopSystemPrompt(store.shopWeapons, store.shopArmors, store.purchasedWeaponIds, store.purchasedArmorIds);
    sendToLLM(shopPrompt, '（玩家刚刚创建完角色并进入商店，请主动向玩家打招呼并开启对话。）', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.dmPhase, store.shopWeapons.length, store.shopArmors.length, restored, isOpen]);

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
    const npcName = getDMName(useDialogueStore.getState().dmPhase);

    const currentPhase = useDialogueStore.getState().dmPhase;

    // 获取当前 messages（用于构建 history）
    // 战斗阶段保留系统消息（包含战斗判定结果），其他阶段过滤系统消息
    const historyMessages: DialogueMessage[] = useDialogueStore.getState().messages.filter((m) => {
      if (currentPhase === 'combat') return true;
      return m.role !== 'system';
    });

    if (showUserMessage) {
      setLoading(true);
      addMessage({ role: 'user', content: userMessage });
    } else {
      setLoading(true);
    }

    try {
      const ctxMsg = currentPhase !== 'creation' ? buildPlayerContextMessage() : '';

      // 构建 history：给每条 user 消息追加实时数据
      const history: ChatMessage[] = historyMessages.map((m) => {
        let content = m.role === 'assistant' && m.rawJson ? m.rawJson : m.content;
        if (m.role === 'user' && ctxMsg) {
          content = `${content}\n\n${ctxMsg}`;
        }
        return {
          role: m.role === 'npc' ? 'assistant' : m.role,
          content,
        };
      });

      // 当前消息也追加实时数据
      let finalUserMessage = ctxMsg ? `${userMessage}\n\n${ctxMsg}` : userMessage;

      // 战斗阶段：追加战斗状态到消息末尾
      if (currentPhase === 'combat') {
        const statusAppendix = getCombatStatusAppendix();
        if (statusAppendix) {
          finalUserMessage = `${finalUserMessage}\n\n${statusAppendix}`;
        }
      }

      const response = await chatWithNPC(
        npcName,
        systemPrompt,
        history,
        finalUserMessage,
        apiKey,
        model,
        apiUrl
      );
      addApiUsage(response.usage);

      // 防御性检查：确保响应内容存在
      if (!response.content || typeof response.content !== 'string') {
        throw new Error('API 返回的响应内容为空');
      }

      let replyContent = response.content;

      let result = parseLLMJson(response.content);

      // 检测 JSON 外是否有多余文本
      const hasExtraText = (() => {
        const content = response.content.trim();
        // 去除 markdown 代码块后检查
        const stripped = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        try {
          // 如果可以直接解析为 JSON，说明没有多余文本
          JSON.parse(stripped);
          return false;
        } catch {
          // 尝试修复后解析
          const repaired = stripped
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/```/g, '');
          try {
            JSON.parse(repaired);
            return false;
          } catch {
            // 检查是否有明显的非 JSON 文本（前后都有内容）
            const firstBrace = stripped.indexOf('{');
            const lastBrace = stripped.lastIndexOf('}');
            if (firstBrace < 0 || lastBrace < 0) return true;
            const before = stripped.substring(0, firstBrace).trim();
            const after = stripped.substring(lastBrace + 1).trim();
            return before.length > 10 || after.length > 10;
          }
        }
      })();

      // 解析失败或有多余文本时重试一次
      if (!result.dialogue || result.error || hasExtraText) {
        const errorParts: string[] = [];
        if (result.error) errorParts.push(`JSON 解析错误: ${result.error}`);
        if (!result.dialogue) errorParts.push('JSON 中缺少 dialogue 字段');
        if (hasExtraText) errorParts.push('JSON 之外包含了其他文本，请严格只返回 JSON，不要任何额外内容');
        const errorHint = errorParts.join('；');
        logError('DM JSON 响应异常，重试', `${errorHint}; 原始内容: ${response.content.slice(0, 500)}`);

        const retryMessage = `你的上一条回复格式有误，无法解析为 JSON。错误原因：${errorHint}。请严格只返回有效的 JSON`;
        const retryResponse = await chatWithNPC(
          npcName,
          systemPrompt,
          [...history, { role: 'user' as const, content: finalUserMessage }, { role: 'assistant' as const, content: response.content }],
          retryMessage,
          apiKey,
          model,
          apiUrl
        );
        addApiUsage(retryResponse.usage);
        replyContent = retryResponse.content;
        result = parseLLMJson(retryResponse.content);
        if (result.dialogue) {
          replyContent = result.dialogue.trim();
        } else {
          logError('DM JSON 重试后仍然解析失败', `原始内容: ${retryResponse.content.slice(0, 500)}`);
        }
      } else {
        replyContent = result.dialogue.trim();
      }

      // 商店阶段 → 冒险阶段
      const dmPhase = useDialogueStore.getState().dmPhase;

      // 提取 options（战斗行动意图消息不显示选项）
      if (result.options && !(dmPhase === 'combat' && result.action)) {
        setOptions(result.options);
      } else {
        setOptions([]);
      }
      if (dmPhase === 'shop' && result.startAdventure) {
        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });

        useDialogueStore.setState({ dmPhase: 'adventure', messages: [], shopWeapons: [], selectedWeaponIds: new Set(), purchasedWeaponIds: new Set(), shopArmors: [], selectedArmorIds: new Set(), purchasedArmorIds: new Set() });
        void saveDMPhase('adventure').catch(() => {});
        void clearShopData().catch(() => {});

        await sendToLLM(
          getSystemPromptForDM('adventure'),
          '（玩家已完成购物准备开始冒险，请主动向玩家打招呼并开启新的冒险旅程。）',
          false
        );
        return;
      }

      // 商店阶段 → LLM 返回 buy 字段，处理购买
      if (dmPhase === 'shop' && result.buy && Array.isArray(result.buy)) {
        const buyIds = result.buy as string[];
        const shopWeapons = useDialogueStore.getState().shopWeapons;
        const shopArmors = useDialogueStore.getState().shopArmors;
        const purchasedWIds = useDialogueStore.getState().purchasedWeaponIds;
        const purchasedAIds = useDialogueStore.getState().purchasedArmorIds;
        const playerGold = usePlayerStore.getState().gold;

        // 验证所有要购买的装备
        const validWeapons: Array<{ w: Record<string, unknown>; price: number }> = [];
        const validArmors: Array<{ a: Record<string, unknown>; price: number }> = [];
        let totalPrice = 0;
        let failedReason = '';

        for (const id of buyIds) {
          const weapon = shopWeapons.find((w) => w.id === id);
          if (weapon) {
            if (purchasedWIds.has(id)) {
              failedReason = `装备 "${weapon.name}" 已售罄`;
              break;
            }
            const price = weapon.price as number;
            totalPrice += price;
            validWeapons.push({ w: weapon, price });
            continue;
          }
          const armor = shopArmors.find((a) => a.id === id);
          if (armor) {
            if (purchasedAIds.has(id)) {
              failedReason = `装备 "${armor.name}" 已售罄`;
              break;
            }
            const price = armor.price as number;
            totalPrice += price;
            validArmors.push({ a: armor, price });
            continue;
          }
          failedReason = `装备 "${id}" 不存在`;
          break;
        }

        if (!failedReason && totalPrice > playerGold) {
          failedReason = `金币不足，总价 ${totalPrice} 金币，玩家当前金币 ${playerGold}`;
        }

        if (failedReason) {
          addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
          await sendToLLM(
            getShopSystemPrompt(store.shopWeapons, store.shopArmors, store.purchasedWeaponIds, store.purchasedArmorIds),
            `（系统提示：无法购买。${failedReason}。）`,
            false
          );
          return;
        }

        // 执行批量购买
        usePlayerStore.getState().deductGold(totalPrice);
        const purchasedNames: string[] = [];
        const newPurchasedW = new Set(purchasedWIds);
        const newPurchasedA = new Set(purchasedAIds);

        for (const { w, price } of validWeapons) {
          const item: Item = {
            id: w.id,
            name: w.name as string,
            type: (w.weaponType === 'melee' ? 'mainWeapon' : 'ranged') as Item['type'],
            description: w.description as string,
            rarity: w.rarity as string,
            weaponType: w.weaponType as 'melee' | 'ranged',
            damage: w.damage as string,
            durability: w.durability as number,
            maxDurability: w.durability as number,
            price,
            effect: w.effect as string | undefined,
            icon: w.icon as string,
          };
          usePlayerStore.getState().addItem(item);
          newPurchasedW.add(w.id);
          purchasedNames.push(w.name as string);
        }

        for (const { a, price } of validArmors) {
          const type = a.armorType === 'helmet' ? 'helmet' : a.armorType === 'chest' ? 'chest' : 'shield';
          const item: Item = {
            id: a.id,
            name: a.name as string,
            type: type as Item['type'],
            description: a.description as string,
            rarity: a.rarity as string,
            damageReduction: a.damageReduction as number | undefined,
            bonusHp: a.bonusHp as number | undefined,
            defense: a.defense as number | undefined,
            durability: a.durability as number,
            maxDurability: a.durability as number,
            price,
            effect: a.effect as string | undefined,
            icon: a.icon as string,
          };
          usePlayerStore.getState().addItem(item);
          newPurchasedA.add(a.id);
          purchasedNames.push(a.name as string);
        }

        useDialogueStore.setState({ purchasedWeaponIds: newPurchasedW, purchasedArmorIds: newPurchasedA });
        void savePurchasedWeaponIds(Array.from(newPurchasedW)).catch(() => {});
        void savePurchasedArmorIds(Array.from(newPurchasedA)).catch(() => {});
        savePlayerStatsToStorage();

        const { gold } = usePlayerStore.getState();
        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
        await sendToLLM(
          getShopSystemPrompt(store.shopWeapons, store.shopArmors, newPurchasedW, newPurchasedA),
          `（系统：已成功购买 ${purchasedNames.join('、')}，共花费 ${totalPrice} 金币，剩余 ${gold} 金币）`,
          true
        );
        return;
      }

      // 冒险阶段：处理金币/经验奖励
      let advRewardGold: number | undefined;
      let advRewardExp: number | undefined;
      let advDeductGold: number | undefined;
      let leveledUp = false;
      if (dmPhase === 'adventure') {
        if (result.rewardGold !== undefined && result.rewardGold !== 0) {
          const goldAmount = result.rewardGold;
          if (goldAmount > 0) {
            usePlayerStore.getState().addGold(goldAmount);
          } else {
            usePlayerStore.getState().deductGold(Math.abs(goldAmount));
          }
          advRewardGold = goldAmount;
        }
        if (result.deductGold !== undefined && result.deductGold > 0) {
          usePlayerStore.getState().deductGold(result.deductGold);
          advDeductGold = result.deductGold;
        }
        if (result.rewardExp !== undefined && result.rewardExp > 0) {
          const beforeLevel = usePlayerStore.getState().level;
          usePlayerStore.getState().addExp(result.rewardExp);
          advRewardExp = result.rewardExp;
          if (usePlayerStore.getState().level > beforeLevel) {
            leveledUp = true;
          }
        }
        savePlayerStatsToStorage();
      }

      // 冒险阶段：处理 attack 字段（标记待进入战斗，用户需手动确认）
      if (dmPhase === 'adventure' && result.attack) {
        const availableMonsterIds = new Set(getAvailableMonsters(usePlayerStore.getState().level).map((m) => m.id));
        const validation = validateAttackPayload(result.attack, availableMonsterIds);
        if (!validation.valid) {
          addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
          await sendToLLM(
            systemPrompt,
            `（系统提示：你返回的 attack 字段不合法。${validation.error}。请重新返回合法的 attack 字段，确保怪物ID来自可用列表且数量在1-3个之间。）`,
            false
          );
          return;
        }

        // 验证通过，添加 DM 消息，标记待进入战斗
        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
        localStorage.setItem('pending_attack', JSON.stringify(result.attack));
        useDialogueStore.setState({ pendingAttack: result.attack });
        setOptions([]);
        return;
      }

      // 战斗阶段：处理 combatResult 字段（战斗结束，标记待返回冒险）
      if (dmPhase === 'combat' && result.combatResult) {
        const combatResult = result.combatResult;
        let combatRewardExp: number | undefined;

        // 胜利时由代码根据怪物数据计算经验奖励（所有怪物 expReward 之和）
        if (combatResult.outcome === 'victory') {
          const monsterIds = useDialogueStore.getState().combatMonsterIds;
          const totalExp = (monstersData as { monsters: Array<{ id: string; expReward: number }> }).monsters
            .filter((m) => monsterIds.includes(m.id))
            .reduce((sum, m) => sum + m.expReward, 0);
          if (totalExp > 0) {
            const beforeLevel = usePlayerStore.getState().level;
            usePlayerStore.getState().addExp(totalExp);
            combatRewardExp = totalExp;
            if (usePlayerStore.getState().level > beforeLevel) {
              leveledUp = true;
            }
          }
        }
        savePlayerStatsToStorage();

        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content, rewardExp: combatRewardExp, leveledUp });

        // 保存战斗历史
        if (store.combatHistoryKey) {
          void saveCombatState(store.combatHistoryKey, useDialogueStore.getState().messages.filter((m) => m.role !== 'system')).catch(() => {});
        }

        // 标记待返回冒险，不立即恢复 DM
        localStorage.setItem('pending_combat_result', JSON.stringify(combatResult));
        useDialogueStore.setState({ pendingCombatResult: combatResult });
        setOptions([]);
        return;
      }

      // 战斗阶段：处理 action 字段（新的战斗行动解析流程）
      if (dmPhase === 'combat' && result.action) {
        const isPlayerTurn = useDialogueStore.getState().combatTurn === 'player';
        const { combatMonsters, combatMonsterIndex } = useDialogueStore.getState();
        const actingMonsterId = isPlayerTurn ? undefined : combatMonsters[combatMonsterIndex]?.uniqueId;

        // 添加行动意图消息（combatAction 标记，UI 中不直接显示）
        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content, combatAction: true });

        // 执行行动判定
        const execResult = executeCombatAction(result.action, isPlayerTurn, actingMonsterId);

        // 添加系统判定消息
        addMessage({ role: 'system', content: execResult.message });

        // 检查战斗结束
        if (execResult.combatEnded && execResult.outcome) {
          // 战斗结束，要求 LLM 生成 combatResult
          const endPrompt = `（系统：战斗已结束，结果：${execResult.outcome}。怪物最终状态：${useDialogueStore.getState().combatMonsters.map(m => `${m.name} HP ${m.currentHp}/${m.maxHp}`).join('，')}。玩家 HP：${usePlayerStore.getState().hp}/${usePlayerStore.getState().maxHp}。请生成战斗结束总结，包含 combatResult 字段。）`;
          await sendToLLM(systemPrompt, endPrompt, false);
          return;
        }

        // 切换回合
        if (isPlayerTurn) {
          // 玩家回合结束，切换到怪物回合
          const aliveMonsters = useDialogueStore.getState().combatMonsters.filter(m => m.currentHp > 0);
          if (aliveMonsters.length === 0) {
            // 所有怪物已死，应该已在上面处理
            return;
          }

          // 找到第一个存活的怪物
          const monsters = useDialogueStore.getState().combatMonsters;
          let nextMonsterIdx = 0;
          while (nextMonsterIdx < monsters.length && monsters[nextMonsterIdx].currentHp <= 0) {
            nextMonsterIdx++;
          }
          useDialogueStore.setState({ combatTurn: 'monster', combatMonsterIndex: nextMonsterIdx });

          const actingMonster = monsters[nextMonsterIdx];
          const statusAppendix = getCombatStatusAppendix();
          const monsterTurnMsg = `（系统：现在是 ${actingMonster.name}（${actingMonster.uniqueId}）的回合。请为其生成行动。）\n\n${statusAppendix}`;
          await sendToLLM(systemPrompt, monsterTurnMsg, false);
          return;
        } else {
          // 怪物回合结束，检查是否还有怪物需要行动
          const monsters = useDialogueStore.getState().combatMonsters;
          let nextMonsterIdx = combatMonsterIndex + 1;
          while (nextMonsterIdx < monsters.length && monsters[nextMonsterIdx].currentHp <= 0) {
            nextMonsterIdx++;
          }

          if (nextMonsterIdx < monsters.length) {
            // 还有怪物需要行动
            useDialogueStore.setState({ combatMonsterIndex: nextMonsterIdx });
            const actingMonster = monsters[nextMonsterIdx];
            const statusAppendix = getCombatStatusAppendix();
            const monsterTurnMsg = `（系统：现在是 ${actingMonster.name}（${actingMonster.uniqueId}）的回合。请为其生成行动。）\n\n${statusAppendix}`;
            await sendToLLM(systemPrompt, monsterTurnMsg, false);
            return;
          } else {
            // 所有怪物已行动，切换回玩家回合
            const newRound = useDialogueStore.getState().combatRound + 1;
            useDialogueStore.setState({ combatTurn: 'player', combatRound: newRound, combatMonsterIndex: 0 });

            const statusAppendix = getCombatStatusAppendix();
            const playerTurnMsg = `（系统：所有怪物已行动完毕。现在又是玩家回合。请根据当前战况向玩家描述场面，并等待玩家输入下一步行动。注意：你只需要描述场面，不要替玩家决定行动。）\n\n${statusAppendix}`;
            await sendToLLM(systemPrompt, playerTurnMsg, false);
            return;
          }
        }
      }

      // 战斗阶段：处理 combatResult 字段（战斗结束，标记待返回冒险）
      if (dmPhase === 'combat' && result.combatResult) {
        const combatResult = result.combatResult;
        let combatRewardExp: number | undefined;

        // 胜利时由代码根据怪物数据计算经验奖励（所有怪物 expReward 之和）
        if (combatResult.outcome === 'victory') {
          const monsterIds = useDialogueStore.getState().combatMonsterIds;
          const totalExp = (monstersData as { monsters: Array<{ id: string; expReward: number }> }).monsters
            .filter((m) => monsterIds.includes(m.id))
            .reduce((sum, m) => sum + m.expReward, 0);
          if (totalExp > 0) {
            const beforeLevel = usePlayerStore.getState().level;
            usePlayerStore.getState().addExp(totalExp);
            combatRewardExp = totalExp;
            if (usePlayerStore.getState().level > beforeLevel) {
              leveledUp = true;
            }
          }
        }
        savePlayerStatsToStorage();

        addMessage({ role: 'assistant', content: replyContent, rawJson: response.content, rewardExp: combatRewardExp, leveledUp });

        // 保存战斗历史
        if (store.combatHistoryKey) {
          void saveCombatState(store.combatHistoryKey, useDialogueStore.getState().messages.filter((m) => m.role !== 'system')).catch(() => {});
        }

        // 标记待返回冒险，不立即恢复 DM
        localStorage.setItem('pending_combat_result', JSON.stringify(combatResult));
        useDialogueStore.setState({ pendingCombatResult: combatResult });
        setOptions([]);
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
            addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
            await sendToLLM(
              systemPrompt,
              `(系统提示：当前角色四维属性之和为${attrSum}，不等于50。请提示玩家修改属性分配，使力量、敏捷、智力、魅力之和恰好为50，每项仍须在8-16之间，然后重新给出角色预览等待玩家确认。)`,
              false
            );
            return;
          }

          // 属性校验通过，先创建角色并写入记忆，再进入头像生成流程
          addMessage({ role: 'assistant', content: replyContent, rawJson: response.content });
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

      addMessage({ role: 'assistant', content: replyContent, rawJson: response.content, rewardGold: advRewardGold, rewardExp: advRewardExp, deductGold: advDeductGold, leveledUp });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('sendToLLM error:', error);
      logError('LLM 对话处理出错', errorMsg);
      addMessage({ role: 'assistant', content: `（对话出错：${errorMsg}）` });
    } finally {
      setLoading(false);
    }
  };

  // 处理 LLM 对话输入
  const handleLLMSubmit = async () => {
    if (!userInput.trim()) return;

    let systemPrompt: string;
    if (store.dmPhase === 'shop') {
      systemPrompt = getShopSystemPrompt(store.shopWeapons, store.shopArmors, store.purchasedWeaponIds, store.purchasedArmorIds);
    } else if (store.dmPhase === 'combat' && store.combatAttackPayload) {
      systemPrompt = getCombatSystemPromptForAttack(store.combatAttackPayload);
    } else {
      systemPrompt = getSystemPromptForDM(store.dmPhase);
    }
    await sendToLLM(systemPrompt, userInput.trim(), true);
    setUserInput('');
  };

  // 处理选项点击
  const handleOptionClick = async (text: string) => {
    let systemPrompt: string;
    if (store.dmPhase === 'shop') {
      systemPrompt = getShopSystemPrompt(store.shopWeapons, store.shopArmors, store.purchasedWeaponIds, store.purchasedArmorIds);
    } else if (store.dmPhase === 'combat' && store.combatAttackPayload) {
      systemPrompt = getCombatSystemPromptForAttack(store.combatAttackPayload);
    } else {
      systemPrompt = getSystemPromptForDM(store.dmPhase);
    }
    // 清除当前选项，防止重复点击
    setOptions([]);
    await sendToLLM(systemPrompt, text, true);
  };

  // 点击"进入战斗"按钮
  const handleEnterCombat = async () => {
    const attack = store.pendingAttack;
    if (!attack) return;

    const preCombatMsgs = useDialogueStore.getState().messages.filter((m) => m.role !== 'system');
    const combatKey = generateCombatHistoryKey();
    localStorage.setItem('combat_history_key', combatKey);
    localStorage.setItem('pre_combat_messages', JSON.stringify(preCombatMsgs));
    localStorage.setItem('combat_attack_payload', JSON.stringify(attack));

    // 初始化战斗怪物状态
    const combatMonsters = buildCombatMonsters(attack);
    localStorage.setItem('combat_monsters', JSON.stringify(combatMonsters));
    localStorage.setItem('combat_turn', 'player');
    localStorage.setItem('combat_round', '1');
    localStorage.setItem('combat_monster_index', '0');

    useDialogueStore.setState({
      dmPhase: 'combat',
      combatHistoryKey: combatKey,
      preCombatMessages: preCombatMsgs,
      combatMonsterIds: attack.monsters.map((m) => m.id),
      combatAttackPayload: attack,
      pendingAttack: null,
      messages: [],
      combatMonsters,
      combatTurn: 'player',
      combatRound: 1,
      combatMonsterIndex: 0,
    });
    void saveDMPhase('combat').catch(() => {});
    localStorage.removeItem('pending_attack');

    const combatSystemPrompt = getCombatSystemPromptForAttack(attack);
    const statusAppendix = getCombatStatusAppendix();
    await sendToLLM(
      combatSystemPrompt,
      `（玩家遭遇了怪物，准备开始战斗。请描述战斗开场。当前是第1回合，玩家先行动。）\n\n${statusAppendix}`,
      false
    );
  };

  // 点击"返回冒险"按钮
  const handleReturnToAdventure = async () => {
    const combatResult = store.pendingCombatResult;
    if (!combatResult) return;

    const preCombatMsgs = store.preCombatMessages;
    const outcome = combatResult.outcome;
    // 胜利时由代码根据怪物数据计算总经验
    let rewardExpText = '';
    if (outcome === 'victory') {
      const monsterIds = store.combatMonsterIds;
      const totalExp = (monstersData as { monsters: Array<{ id: string; expReward: number }> }).monsters
        .filter((m) => monsterIds.includes(m.id))
        .reduce((sum, m) => sum + m.expReward, 0);
      if (totalExp > 0) {
        rewardExpText = `玩家已获得 ${totalExp} 经验值，你无需重复奖励经验。`;
      }
    }
    const battleSummaryText = combatResult.battleSummary ? `战斗过程简述：${combatResult.battleSummary}` : '';
    const resumeMessage = `（系统提示：玩家与怪物的战斗已结束。战斗结果：${outcome}。${rewardExpText}${battleSummaryText ? battleSummaryText + '。' : ''}请根据此结果继续推进冒险剧情。）`;

    useDialogueStore.setState({
      dmPhase: 'adventure',
      messages: preCombatMsgs,
      combatHistoryKey: null,
      preCombatMessages: [],
      combatMonsterIds: [],
      combatAttackPayload: null,
      pendingCombatResult: null,
      combatMonsters: [],
      combatTurn: 'player',
      combatRound: 1,
      combatMonsterIndex: 0,
    });
    void saveDMPhase('adventure').catch(() => {});
    localStorage.removeItem('combat_history_key');
    localStorage.removeItem('pre_combat_messages');
    localStorage.removeItem('combat_attack_payload');
    localStorage.removeItem('pending_combat_result');
    localStorage.removeItem('combat_monsters');
    localStorage.removeItem('combat_turn');
    localStorage.removeItem('combat_round');
    localStorage.removeItem('combat_monster_index');

    await sendToLLM(
      getSystemPromptForDM('adventure'),
      resumeMessage,
      false
    );
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
            {/* 商店阶段：装备选择面板（武器 + 防具） */}
            {store.dmPhase === 'shop' && (store.shopWeapons.length > 0 || store.shopArmors.length > 0) && (
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
                      }, 0) +
                      Array.from(store.selectedArmorIds)
                      .reduce((sum, id) => {
                        const a = store.shopArmors.find((x) => x.id === id);
                        return sum + (a?.price ?? 0);
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
                        <div className="text-gray-300 text-[11px]">{weapon.weaponType === 'melee' ? '近战' : '远程'} 伤害: {weapon.damage}  持久: {weapon.durability}</div>
                        <div className="text-gray-400 mt-0.5 leading-tight line-clamp-2" style={{ fontSize: '10px' }}>{weapon.description}</div>
                        {isPurchased && (
                          <div className="text-green-400 text-[11px] font-semibold">已卖完</div>
                        )}
                        {isSelected && !isPurchased && (
                          <div className="text-blue-300 text-[11px] font-semibold">已选中</div>
                        )}
                      </div>
                    );
                  })}
                  {store.shopArmors.map((armor) => {
                    const gold = usePlayerStore.getState().gold;
                    const isSelected = store.selectedArmorIds.has(armor.id);
                    const isPurchased = store.purchasedArmorIds.has(armor.id);
                    const selectedTotal = Array.from(store.selectedWeaponIds)
                      .reduce((sum, id) => {
                        const w = store.shopWeapons.find((x) => x.id === id);
                        return sum + (w?.price ?? 0);
                      }, 0) +
                      Array.from(store.selectedArmorIds)
                      .filter((id) => id !== armor.id)
                      .reduce((sum, id) => {
                        const a = store.shopArmors.find((x) => x.id === id);
                        return sum + (a?.price ?? 0);
                      }, 0);
                    const canAfford = !isPurchased && gold >= selectedTotal + armor.price;
                    const isDisabled = isPurchased || !canAfford;
                    const typeLabel = armor.armorType === 'helmet' ? '头盔' : armor.armorType === 'chest' ? '护甲' : '盾牌';
                    let statText = '';
                    if (armor.armorType === 'helmet') {
                      statText = `减伤 ${Math.round((armor.damageReduction ?? 0) * 100)}%  持久 ${armor.durability}`;
                    } else if (armor.armorType === 'chest') {
                      statText = `生命 +${armor.bonusHp ?? 0}`;
                    } else {
                      statText = `防御 ${armor.defense ?? 0}  持久 ${armor.durability}`;
                    }
                    return (
                      <div
                        key={armor.id}
                        className={`rounded-lg p-1.5 text-xs transition-all border ${
                          isSelected
                            ? 'border-blue-400 bg-blue-900/50 cursor-pointer'
                            : isDisabled
                              ? 'border-gray-600 bg-gray-800 opacity-50 cursor-not-allowed pointer-events-none'
                              : 'border-gray-500 bg-gray-700 hover:border-gray-400 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isDisabled) return;
                          const ids = new Set(useDialogueStore.getState().selectedArmorIds);
                          if (ids.has(armor.id)) ids.delete(armor.id);
                          else ids.add(armor.id);
                          useDialogueStore.setState({ selectedArmorIds: ids });
                        }}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img src={`/${armor.icon}`} alt={armor.name} className="w-5 h-5 object-contain" />
                            <span className="text-white font-semibold truncate">{armor.name}</span>
                          </div>
                          <span className="text-yellow-300 text-[11px] flex-shrink-0">{armor.price} 金</span>
                        </div>
                        <div className="text-gray-300 text-[11px]">{typeLabel}  {statText}</div>
                        <div className="text-gray-400 mt-0.5 leading-tight line-clamp-2" style={{ fontSize: '10px' }}>{armor.description}</div>
                        {isPurchased && (
                          <div className="text-green-400 text-[11px] font-semibold">已卖完</div>
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
                      store.selectedWeaponIds.size + store.selectedArmorIds.size > 0
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={store.selectedWeaponIds.size + store.selectedArmorIds.size === 0}
                    onClick={() => {
                      const totalPrice =
                        Array.from(store.selectedWeaponIds).reduce((sum, id) => {
                          const w = store.shopWeapons.find((x) => x.id === id);
                          return sum + (w?.price ?? 0);
                        }, 0) +
                        Array.from(store.selectedArmorIds).reduce((sum, id) => {
                          const a = store.shopArmors.find((x) => x.id === id);
                          return sum + (a?.price ?? 0);
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

                      for (const armorId of store.selectedArmorIds) {
                        const preset = store.shopArmors.find((a) => a.id === armorId);
                        if (!preset) continue;
                        purchaseNames.push(preset.name);
                        const type = preset.armorType === 'helmet' ? 'helmet' : preset.armorType === 'chest' ? 'chest' : 'shield';
                        const item: Item = {
                          id: preset.id,
                          name: preset.name,
                          type: type as Item['type'],
                          description: preset.description,
                          rarity: preset.rarity,
                          damageReduction: preset.damageReduction,
                          bonusHp: preset.bonusHp,
                          defense: preset.defense,
                          durability: preset.durability,
                          maxDurability: preset.durability,
                          price: preset.price,
                          effect: preset.effect,
                          icon: preset.icon,
                        };
                        addItem(item);
                      }

                      deductGold(totalPrice);
                      const { gold } = usePlayerStore.getState();
                      const newPurchasedW = new Set(useDialogueStore.getState().purchasedWeaponIds);
                      const newPurchasedA = new Set(useDialogueStore.getState().purchasedArmorIds);
                      store.selectedWeaponIds.forEach((id) => newPurchasedW.add(id));
                      store.selectedArmorIds.forEach((id) => newPurchasedA.add(id));
                      useDialogueStore.setState({ selectedWeaponIds: new Set(), selectedArmorIds: new Set(), purchasedWeaponIds: newPurchasedW, purchasedArmorIds: newPurchasedA });
                      void savePurchasedWeaponIds(Array.from(newPurchasedW)).catch(() => {});
                      void savePurchasedArmorIds(Array.from(newPurchasedA)).catch(() => {});
                      savePlayerStatsToStorage();

                      const systemPrompt = getShopSystemPrompt(store.shopWeapons, store.shopArmors, newPurchasedW, newPurchasedA);
                      const userMessage = `（系统：已成功购买 ${purchaseNames.join('、')}，共花费 ${totalPrice} 金币，剩余 ${gold} 金币）`;
                      void sendToLLM(systemPrompt, userMessage, true);
                    }}
                  >
                    购买 {store.selectedWeaponIds.size + store.selectedArmorIds.size > 0 ? `（${
                        Array.from(store.selectedWeaponIds).reduce((sum, id) => {
                          const w = store.shopWeapons.find((x) => x.id === id);
                          return sum + (w?.price ?? 0);
                        }, 0) +
                        Array.from(store.selectedArmorIds).reduce((sum, id) => {
                          const a = store.shopArmors.find((x) => x.id === id);
                          return sum + (a?.price ?? 0);
                        }, 0)
                    } 金币）` : ''}
                  </button>
                  {store.selectedWeaponIds.size + store.selectedArmorIds.size > 0 && (
                    <span className="text-gray-400 text-xs">
                      已选 {store.selectedWeaponIds.size + store.selectedArmorIds.size} 件
                    </span>
                  )}
                </div>
              </div>
            )}

            {messages
              .filter((m) => m.role !== 'system' && !m.combatAction)
              .map((msg, idx) => (
                <div key={idx}>
                  <div
                    className={`p-3 rounded-lg max-w-[85%] break-words whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 ml-auto'
                        : 'bg-gray-600 mr-auto'
                    }`}
                  >
                    {renderBoldText(msg.content)}
                  </div>
                  {msg.rewardGold !== undefined && msg.rewardGold !== 0 && msg.rewardGold > 0 && (
                    <div className="ml-1 mt-1">
                      <span className="text-yellow-400 text-sm">（获得 {msg.rewardGold} 金币）</span>
                    </div>
                  )}
                  {msg.deductGold !== undefined && msg.deductGold > 0 && (
                    <div className="ml-1 mt-1">
                      <span className="text-red-400 text-sm">（失去 {msg.deductGold} 金币）</span>
                    </div>
                  )}
                  {msg.rewardExp !== undefined && msg.rewardExp > 0 && (
                    <div className="ml-1 mt-1">
                      <span className="text-purple-400 text-sm">（获得 {msg.rewardExp} 经验）</span>
                    </div>
                  )}
                  {msg.leveledUp && (
                    <div className="ml-1 mt-1">
                      <span className="text-green-400 text-sm font-semibold">（升级！达到 Lv.{usePlayerStore.getState().level}）</span>
                    </div>
                  )}
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
            {store.pendingAttack ? (
              <button
                className="w-full bg-red-600 hover:bg-red-500 text-white text-xl font-bold py-5 rounded shadow-lg transition-colors"
                onClick={handleEnterCombat}
              >
                进入战斗
              </button>
            ) : store.pendingCombatResult ? (
              <button
                className="w-full bg-green-600 hover:bg-green-500 text-white text-xl font-bold py-5 rounded shadow-lg transition-colors"
                onClick={handleReturnToAdventure}
              >
                返回冒险
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialogue;
