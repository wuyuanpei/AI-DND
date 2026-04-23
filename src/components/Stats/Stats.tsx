import React from 'react';
import { usePlayerStore, getExpToNext, MAX_LEVEL } from '../../store/playerStore';

const Stats: React.FC = () => {
  const { name, level, hp, maxHp, mp, maxMp, exp, gold, defense, strength, agility, intelligence, charisma, avatar } = usePlayerStore();

  const hpPercent = (hp / maxHp) * 100;
  const mpPercent = (mp / maxMp) * 100;
  const expToNext = level >= MAX_LEVEL ? '已满级' : `${exp}/${getExpToNext(level)}`;

  return (
    <div className="flex flex-col">
      <h3 className="text-white text-lg font-bold mb-2 border-b border-gray-600 pb-1 flex-shrink-0">
        冒险者
      </h3>

      {/* 头像占位 */}
      <div className="flex-shrink-0 flex justify-center mb-2 mt-1">
        <div className="w-full max-w-[150px] aspect-square bg-gray-600 rounded border-2 border-gray-500 flex items-center justify-center overflow-hidden">
          {avatar ? (
            <img src={avatar} alt="角色头像" className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🧙</span>
          )}
        </div>
      </div>

      {/* 名字和等级 */}
      <div className="flex-shrink-0 text-center mb-2">
        <div className="text-white text-base font-bold">{name}</div>
        <div className="text-yellow-400 text-sm">Lv.{level} (经验: {expToNext})</div>
      </div>

      {/* 血条 */}
      <div className="flex-shrink-0 mb-2">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>HP</span>
          <span className="text-red-400">{hp}/{maxHp}</span>
        </div>
        <div className="h-3 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* 魔法条 */}
      <div className="flex-shrink-0 mb-2">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>MP</span>
          <span className="text-blue-400">{mp}/{maxMp}</span>
        </div>
        <div className="h-3 bg-gray-600 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${mpPercent}%` }}
          />
        </div>
      </div>

      {/* 金币和防御 */}
      <div className="flex-shrink-0 text-center py-1 flex justify-center gap-4">
        <div className="text-yellow-400 text-sm">
          💰 {gold} 金币
        </div>
        <div className="text-gray-300 text-sm">
          🛡️ 防御 {defense}
        </div>
      </div>

      {/* 四维属性 */}
      <div className="flex-shrink-0 mt-auto pt-2 border-t border-gray-600">
        <div className="grid grid-cols-2 gap-2 text-sm">
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
