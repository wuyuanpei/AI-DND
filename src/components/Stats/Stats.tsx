import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

const Stats: React.FC = () => {
  const { name, level, hp, maxHp, mp, maxMp, exp, gold, strength, agility, intelligence, charisma } = usePlayerStore();

  const hpPercent = (hp / maxHp) * 100;
  const mpPercent = (mp / maxMp) * 100;
  // 简单计算：每级 100exp，升级需要 level * 100 exp
  const expToNextLevel = level * 100;
  const expPercent = Math.min(100, (exp / expToNextLevel) * 100);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h3 className="text-white text-sm font-bold mb-1 border-b border-gray-600 pb-1 flex-shrink-0">
        冒险者
      </h3>

      {/* 头像占位 - 3:4 比例，与栏目标齐宽 (180px : 240px = 4:3) */}
      <div className="flex-shrink-0 flex justify-center mb-1 mt-1">
        <div className="w-[180px] h-[240px] bg-gray-600 rounded border-2 border-gray-500 flex items-center justify-center overflow-hidden">
          {/* 暂时用 emoji 占位，之后可以替换为 img 标签 */}
          <span className="text-6xl">🧙</span>
        </div>
      </div>

      {/* 名字和等级 */}
      <div className="flex-shrink-0 text-center mb-1">
        <div className="text-white text-sm font-bold">{name}</div>
        <div className="text-yellow-400 text-xs">Lv.{level}</div>
      </div>

      {/* 经验条 */}
      <div className="flex-shrink-0 mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>EXP</span>
          <span>{exp}/{expToNextLevel}</span>
        </div>
        <div className="h-2 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${expPercent}%` }}
          />
        </div>
      </div>

      {/* 血条 */}
      <div className="flex-shrink-0 mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>HP</span>
          <span className="text-red-400">{hp}/{maxHp}</span>
        </div>
        <div className="h-2 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 魔法条 */}
      <div className="flex-shrink-0 mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>MP</span>
          <span className="text-blue-400">{mp}/{maxMp}</span>
        </div>
        <div className="h-2 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${mpPercent}%` }}
          />
        </div>
      </div>

      {/* 金币 */}
      <div className="flex-shrink-0 text-center py-1">
        <div className="text-yellow-400 text-xs">
          💰 {gold} 金币
        </div>
      </div>

      {/* 四维属性 */}
      <div className="flex-shrink-0 mt-auto pt-1 border-t border-gray-600">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex justify-between text-gray-300">
            <span>力量</span>
            <span className="text-white">{strength}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>敏捷</span>
            <span className="text-white">{agility}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>智力</span>
            <span className="text-white">{intelligence}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>魅力</span>
            <span className="text-white">{charisma}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
