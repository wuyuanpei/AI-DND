import React, { useEffect } from 'react';
import Equipment from '../Equipment/Equipment';
import Spells from '../Spells/Spells';
import Dialogue from '../Dialogue/Dialogue';
import Stats from '../Stats/Stats';
import WorldPanel from '../WorldPanel/WorldPanel';
import Settings from '../Settings/Settings';
import Rules from '../Rules/Rules';
import Encyclopedia from '../Encyclopedia/Encyclopedia';
import Inventory from '../Inventory/Inventory';
import GameLogs from '../GameLogs/GameLogs';
import Memory from '../Memory/Memory';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { useDialogueStore } from '../../store/dialogueStore';
import { useWorldStore } from '../../store/worldStore';
import { logMemory } from '../../store/logStore';
import { loadPlayerJson, loadAvatar, clearPlayerData, clearShopWeapons } from '../../utils/playerDB';
import { savePlayerStatsToStorage, loadPlayerStatsFromStorage, clearPlayerStats } from '../../utils/playerStats';

const GameLayout: React.FC = () => {
  const { apiCallCount, totalPromptTokens, totalCompletionTokens, totalTokens } = useSettingsStore();

  // 启动时从 localStorage 恢复玩家数值，从 IndexedDB 加载文本、player.md 和头像
  useEffect(() => {
    (async () => {
      // 先从 localStorage 恢复数值
      loadPlayerStatsFromStorage();

      // 从 IndexedDB 加载玩家文本信息并回填到 playerStore
      const text = await loadPlayerJson();
      if (text) {
        usePlayerStore.setState({
          name: text.name,
          gender: text.gender,
          appearance: text.appearance,
          personality: text.personality,
          backstory: text.backstory,
        });
      }

      // 从 IndexedDB 加载头像 Blob 并转为 data URL
      const avatar = await loadAvatar();
      if (avatar) {
        usePlayerStore.setState({ avatar });
      }
    })();
  }, []);

  // 玩家状态变化时自动持久化到 localStorage
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe(() => {
      savePlayerStatsToStorage();
    });
    return unsubscribe;
  }, []);

  const handleRestart = async () => {
    usePlayerStore.getState().resetPlayer();
    useDialogueStore.getState().resetDialogue();
    useWorldStore.setState({});
    await clearPlayerData();
    await clearShopWeapons();
    clearPlayerStats();
    logMemory('清空玩家记忆卡片', 'IndexedDB: playerJson, avatar, logs');
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden p-5">
      {/* 顶部状态栏 */}
      <div className="flex-shrink-0 flex items-center justify-between bg-gray-800 rounded-lg px-5 py-3 mb-4 w-full max-w-[1920px] mx-auto">
        <div className="flex items-center gap-4">
          <span className="text-white text-base font-bold">第一章 命运的起点</span>
          <span className="text-gray-400 text-sm">当前任务：暂无</span>
        </div>
        <div className="flex items-center gap-2">
          <Encyclopedia />
          <Memory />
          <GameLogs />
          <Rules />
          <Settings />
        </div>
      </div>

      {/* 主容器 */}
      <div className="flex gap-5 bg-gray-800 rounded-lg p-5 flex-1 w-full max-w-[1920px] mx-auto min-h-0">
        {/* 左侧列：世界状态 + 背包 */}
        <div className="w-[260px] flex flex-col gap-5 h-full overflow-y-auto">
          <div className="bg-gray-700 rounded-lg p-4 flex-shrink-0 min-h-[28rem]">
            <WorldPanel />
          </div>
          <div className="bg-gray-700 rounded-lg p-4 flex-1 min-h-0 overflow-hidden">
            <Inventory />
          </div>
        </div>

        {/* 中间列：对话栏 */}
        <div className="flex-1 min-w-0 bg-gray-700 rounded-lg p-4 overflow-hidden h-full">
          <Dialogue />
        </div>

        {/* 右侧列：状态 + 装备 + 技能 */}
        <div className="w-[260px] flex flex-col gap-5 h-full overflow-y-auto">
          <div className="bg-gray-700 rounded-lg p-4 flex-shrink-0 min-h-[28rem]">
            <Stats />
          </div>
          <div className="bg-gray-700 rounded-lg p-4 flex-shrink-0">
            <Equipment />
          </div>
          <div className="bg-gray-700 rounded-lg p-4 flex-1 min-h-0 overflow-hidden">
            <Spells />
          </div>
        </div>
      </div>

      {/* API 统计信息 - 底部 */}
      <div className="flex-shrink-0 flex items-center justify-center gap-8 text-sm text-gray-400 py-3">
        <button
          className="text-red-400 hover:text-red-300 transition-colors"
          onClick={handleRestart}
        >
          重新开始游戏
        </button>
        <span>API 调用：{apiCallCount} 次</span>
        <span>Prompt Token: {totalPromptTokens}</span>
        <span>Completion Token: {totalCompletionTokens}</span>
        <span>Total Token: {totalTokens}</span>
        <button
          className="ml-2 text-gray-500 hover:text-blue-400 transition-colors"
          title="清零统计数据"
          onClick={() => useSettingsStore.getState().resetStats()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default GameLayout;
