import React, { useEffect } from 'react';
import Map from '../Map/Map';
import Equipment from '../Equipment/Equipment';
import Spells from '../Spells/Spells';
import Dialogue from '../Dialogue/Dialogue';
import Stats from '../Stats/Stats';
import WorldPanel from '../WorldPanel/WorldPanel';
import Settings from '../Settings/Settings';
import { saveGame, loadGame } from '../../store/saveSystem';

/**
 * 游戏主布局
 *
 * ┌─────────────────────────────────────────────────┐
 * │                                                 │
 * │  ┌──────┐  ┌────────────────────┐  ┌─────────┐  │
 * │  │      │  │                    │  │ 装备栏  │  │
 * │  │世界  │  │       地图         │  ├─────────┤  │
 * │  │状态  │  │  (背景图+图元)     │  │技能/    │  │
 * │  │NPC   │  │                    │  │法术栏   │  │
 * │  └──────┘  └────────────────────┘  └─────────┘  │
 * │                                                 │
 * │  ┌─────────────────────────┐  ┌──────────────┐  │
 * │  │       对话栏            │  │  血条/状态   │  │
 * │  └─────────────────────────┘  └──────────────┘  │
 * └─────────────────────────────────────────────────┘
 */

const GameLayout: React.FC = () => {
  // 启动时加载存档
  useEffect(() => {
    loadGame();
  }, []);

  // 自动保存（每30秒）
  useEffect(() => {
    const interval = setInterval(saveGame, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="grid grid-cols-[200px_1024px_200px] grid-rows-[1fr_150px] gap-4 bg-gray-800 rounded-lg p-4">
        {/* 左侧面板 - 世界状态/NPC */}
        <div className="row-span-1 bg-gray-700 rounded-lg p-3 flex flex-col">
          <WorldPanel />
          <div className="mt-auto pt-2 border-t border-gray-600">
            <Settings />
          </div>
        </div>

        {/* 中央地图 */}
        <div className="bg-gray-700 rounded-lg overflow-hidden">
          <Map />
        </div>

        {/* 右侧面板上方 - 装备栏 */}
        <div className="bg-gray-700 rounded-lg p-3">
          <Equipment />
        </div>

        {/* 右侧面板下方 - 技能/法术栏 (跨行到第二行) */}
        <div className="bg-gray-700 rounded-lg p-3 row-span-1 col-start-3">
          <Spells />
        </div>

        {/* 下方左边 - 对话栏 */}
        <div className="bg-gray-700 rounded-lg p-3 col-start-2">
          <Dialogue />
        </div>

        {/* 下方右边 - 血条/状态 */}
        <div className="bg-gray-700 rounded-lg p-3 col-start-3">
          <Stats />
        </div>
      </div>
    </div>
  );
};

export default GameLayout;