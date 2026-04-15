import React, { useEffect } from 'react';
import Map from '../Map/Map';
import Equipment from '../Equipment/Equipment';
import Spells from '../Spells/Spells';
import Dialogue from '../Dialogue/Dialogue';
import Stats from '../Stats/Stats';
import WorldPanel from '../WorldPanel/WorldPanel';
import Settings from '../Settings/Settings';
import Rules from '../Rules/Rules';
import Inventory from '../Inventory/Inventory';
import GameLogs from '../GameLogs/GameLogs';
import ScriptManager from '../ScriptManager/ScriptManager';
import { saveGame, loadGame } from '../../store/saveSystem';
import { useSettingsStore } from '../../store/settingsStore';
import { useScriptStore } from '../../store/scriptStore';

/**
 * 游戏主布局 - 4:3 比例
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                                                                      │
 * │  ┌────────┐  ┌──────────────────────┐  ┌────────────────────────┐    │
 * │  │        │  │                      │  │  冒险者状态 (522px)    │    │
 * │  │ 世界   │  │                      │  ├────────────────────────┤   │
 * │  │ 状态   │  │       地 图          │  │  装备 (230px, 3x3)     │    │
 * │  │        │  │     (1024x768)       │  └────────────────────────┘    │
 * │  │        │  │                      │                                 │
 * │  └────────┘  └──────────────────────┘                                 │
 * │  ┌────────────┐  ┌─────────────────────────┐  ┌───────────────────┐   │
 * │  │ 背包 (4x5) │  │      对 话 栏           │  │  技能 (3x3)       │   │
 * │  │ 420px      │  │      420px              │  │  420px            │   │
 * │  └────────────┘  └─────────────────────────┘  └───────────────────┘   │
 * └──────────────────────────────────────────────────────────────────────┘
 */

const GameLayout: React.FC = () => {
  const { apiCallCount, totalPromptTokens, totalCompletionTokens, totalTokens } = useSettingsStore();
  const { activeScript } = useScriptStore();
  const currentAct = activeScript?.acts.find(a => a.id === activeScript.currentActId);

  // 启动时加载存档
  useEffect(() => {
    loadGame();
  }, []);

  // 自动保存（每 30 秒）
  useEffect(() => {
    const interval = setInterval(saveGame, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* 设置按钮 - 右上角 */}
      <Settings />
      {/* 规则按钮 - 设置按钮左边 */}
      <Rules />
      {/* 日志按钮 - 规则按钮左边 */}
      <GameLogs />
      {/* 剧本按钮 - 日志按钮左边 */}
      <ScriptManager />

      {/* 剧本信息 - 页面最上方 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 rounded-lg px-5 py-2 text-sm text-gray-300 max-w-[1024px] w-full border border-gray-600 shadow-lg">
        {activeScript ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-yellow-400 font-bold text-base whitespace-nowrap">{activeScript.title}</span>
              {currentAct ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-yellow-300 text-sm font-medium whitespace-nowrap">▸ {currentAct.title}</span>
                  <span className="text-gray-500 text-xs truncate">{currentAct.synopsis}</span>
                </div>
              ) : (
                activeScript.description && <span className="text-gray-500 text-xs truncate">{activeScript.description}</span>
              )}
            </div>
            {activeScript.author && (
              <span className="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">作者：{activeScript.author}</span>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">未导入剧本</div>
        )}
      </div>

      {/* 主容器 */}
      <div className="flex flex-col gap-4 bg-gray-800 rounded-lg p-4">
        {/* 上半部分：地图 + 左右面板 */}
        <div className="flex gap-4">
          {/* 左侧面板：200px 宽 */}
          <div className="w-[200px] flex flex-col gap-4">
            <div className="bg-gray-700 rounded-lg p-3 flex-1 min-h-[400px]">
              <WorldPanel />
            </div>
          </div>

          {/* 中央地图：1024x768 */}
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <Map />
          </div>

          {/* 右侧面板：200px 宽 */}
          <div className="w-[200px] flex flex-col gap-4">
            <div className="bg-gray-700 rounded-lg p-3 h-[522px]">
              <Stats />
            </div>
            <div className="bg-gray-700 rounded-lg p-3 h-[230px]">
              <Equipment />
            </div>
          </div>
        </div>

        {/* 下半部分：背包 + 对话框 + 技能 - 固定 420px 高 */}
        <div className="flex gap-4 h-[420px]">
          {/* 背包 - 左侧 200px */}
          <div className="w-[200px] bg-gray-700 rounded-lg p-3 h-full">
            <Inventory />
          </div>
          {/* 对话框 - 中间 固定宽度 */}
          <div className="w-[1024px] min-w-0 bg-gray-700 rounded-lg p-3 h-full overflow-hidden">
            <Dialogue />
          </div>
          {/* 技能 - 右侧 200px */}
          <div className="w-[200px] bg-gray-700 rounded-lg p-3 h-full">
            <Spells />
          </div>
        </div>

        {/* API 统计信息 - 底部 */}
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
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
