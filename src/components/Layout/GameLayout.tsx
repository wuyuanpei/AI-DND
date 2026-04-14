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
import { saveGame, loadGame } from '../../store/saveSystem';

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
    <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
      {/* 设置按钮 - 右上角 */}
      <Settings />
      {/* 规则按钮 - 设置按钮左边 */}
      <Rules />

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
          {/* 对话框 - 中间 flex-1 */}
          <div className="flex-1 bg-gray-700 rounded-lg p-3 h-full overflow-hidden">
            <Dialogue />
          </div>
          {/* 技能 - 右侧 200px */}
          <div className="w-[200px] bg-gray-700 rounded-lg p-3 h-full">
            <Spells />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLayout;
