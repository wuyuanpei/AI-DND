import React from 'react';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';

const WorldPanel: React.FC = () => {
  const { mapData, completedQuests } = useWorldStore();
  const { position } = usePlayerStore();

  // 获取NPC和敌人列表
  const npcs = mapData?.markers.filter((m) => m.type === 'npc') || [];
  const enemies = mapData?.markers.filter((m) => m.type === 'enemy') || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h3 className="text-white text-sm font-bold mb-2 border-b border-gray-600 pb-1">
        世界状态
      </h3>

      {/* 当前地图 */}
      <div className="text-xs text-green-400 mb-2">
        地图: {mapData?.name || '未知'}
      </div>

      {/* 玩家位置 */}
      <div className="text-xs text-gray-400 mb-2">
        位置: ({position.x}, {position.y})
      </div>

      {/* NPC列表 */}
      <div className="mb-2">
        <div className="text-xs text-yellow-400 mb-1">NPC:</div>
        <div className="overflow-y-auto max-h-20">
          {npcs.map((npc) => (
            <div
              key={npc.id}
              className="text-xs text-gray-300 bg-gray-600 rounded px-2 py-1 mb-1"
            >
              {npc.name || 'NPC'} ({npc.x}, {npc.y})
            </div>
          ))}
        </div>
      </div>

      {/* 敌人列表 */}
      <div className="mb-2">
        <div className="text-xs text-red-400 mb-1">敌人:</div>
        <div className="overflow-y-auto max-h-20">
          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className="text-xs text-gray-300 bg-gray-600 rounded px-2 py-1 mb-1"
            >
              {enemy.name || '敌人'} ({enemy.x}, {enemy.y})
              {enemy.hp && (
                <span className="text-red-400 ml-1">
                  HP: {enemy.hp}/{enemy.maxHp}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 已完成任务 */}
      {completedQuests.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-purple-400 mb-1">已完成任务:</div>
          <div className="text-xs text-gray-300">
            {completedQuests.map((q) => (
              <div key={q} className="bg-gray-600 rounded px-2 py-1 mb-1">
                {q}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldPanel;