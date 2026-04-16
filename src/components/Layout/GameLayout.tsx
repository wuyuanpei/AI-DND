import React, { useEffect } from 'react';
import Equipment from '../Equipment/Equipment';
import Spells from '../Spells/Spells';
import Dialogue from '../Dialogue/Dialogue';
import Stats from '../Stats/Stats';
import WorldPanel from '../WorldPanel/WorldPanel';
import Settings from '../Settings/Settings';
import Rules from '../Rules/Rules';
import Inventory from '../Inventory/Inventory';
import GameLogs from '../GameLogs/GameLogs';
import Memory from '../Memory/Memory';
import { saveGame, loadGame, deleteSave } from '../../store/saveSystem';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { useDialogueStore } from '../../store/dialogueStore';
import { useWorldStore } from '../../store/worldStore';
import { logMemory } from '../../store/logStore';

const GameLayout: React.FC = () => {
  const { apiCallCount, totalPromptTokens, totalCompletionTokens, totalTokens } = useSettingsStore();

  // 启动时加载存档
  useEffect(() => {
    loadGame();
  }, []);

  // 自动保存（每 30 秒）
  useEffect(() => {
    const interval = setInterval(saveGame, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = () => {
    usePlayerStore.getState().resetPlayer();
    useDialogueStore.getState().resetDialogue();
    useWorldStore.setState({});
    deleteSave();
    logMemory('清空玩家记忆卡片', 'key: ai-dnd-player-md');
    localStorage.removeItem('ai-dnd-player-md');
    localStorage.removeItem('ai-dnd-player-avatar');
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* 设置按钮 - 右上角 */}
      <Settings />
      {/* 规则按钮 - 设置按钮左边 */}
      <Rules />
      {/* 日志按钮 - 规则按钮左边 */}
      <GameLogs />
      {/* 记忆按钮 - 日志按钮左边 */}
      <Memory />

      {/* 主容器 */}
      <div className="flex gap-4 bg-gray-800 rounded-lg p-4">
        {/* 左侧列：世界状态 + 背包 */}
        <div className="w-[200px] flex flex-col gap-4">
          <div className="bg-gray-700 rounded-lg p-3 h-[768px]">
            <WorldPanel />
          </div>
          <div className="bg-gray-700 rounded-lg p-3 h-[420px]">
            <Inventory />
          </div>
        </div>

        {/* 中间列：对话栏（占据原地图+下排对话区域） */}
        <div className="w-[1024px] min-w-0 bg-gray-700 rounded-lg p-3 overflow-hidden" style={{ height: '1192px' }}>
          <Dialogue />
        </div>

        {/* 右侧列：状态 + 装备 + 技能 */}
        <div className="w-[200px] flex flex-col gap-4">
          <div className="bg-gray-700 rounded-lg p-3 h-[522px]">
            <Stats />
          </div>
          <div className="bg-gray-700 rounded-lg p-3 h-[230px]">
            <Equipment />
          </div>
          <div className="bg-gray-700 rounded-lg p-3 flex-1">
            <Spells />
          </div>
        </div>

        {/* API 统计信息 - 底部（通过绝对定位保持在页面底部） */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 text-xs text-gray-400">
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
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameLayout;
