import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

const Stats: React.FC = () => {
  const { name, level, hp, maxHp, mp, maxMp, exp, gold } = usePlayerStore();

  const hpPercent = (hp / maxHp) * 100;
  const mpPercent = (mp / maxMp) * 100;

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-white text-sm font-bold mb-2 border-b border-gray-600 pb-1">
        {name}
      </h3>

      {/* 等级 */}
      <div className="text-xs text-yellow-400 mb-2">Lv.{level}</div>

      {/* 血条 */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>HP</span>
          <span>{hp}/{maxHp}</span>
        </div>
        <div className="h-4 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 魔法条 */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>MP</span>
          <span>{mp}/{maxMp}</span>
        </div>
        <div className="h-4 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${mpPercent}%` }}
          />
        </div>
      </div>

      {/* 经验和金币 */}
      <div className="flex justify-between text-xs mt-2">
        <span className="text-purple-400">EXP: {exp}</span>
        <span className="text-yellow-400">金币: {gold}</span>
      </div>
    </div>
  );
};

export default Stats;