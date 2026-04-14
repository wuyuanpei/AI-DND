import React from 'react';
import { usePlayerStore, getSkillCap } from '../../store/playerStore';

const Spells: React.FC = () => {
  const { skills, level } = usePlayerStore();

  // 计算技能上限：基础 3 个 + 每级 +1，满级 12 个
  const skillCap = getSkillCap(level);
  // 已学习技能数量
  const learnedCount = skills.length;

  // 创建技能格子数组，长度为技能上限
  const skillSlots = Array.from({ length: skillCap }, (_, i) => skills[i]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h3 className="text-white text-sm font-bold mb-1 border-b border-gray-600 pb-1 flex-shrink-0">
        技能
      </h3>
      {/* 学习进度 */}
      <div className="text-xs text-blue-400 mb-1 flex-shrink-0">
        学习：{learnedCount}/{skillCap}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-3 gap-1.5 h-full content-start">
          {skillSlots.map((skill, idx) => (
            <div
              key={idx}
              className={`aspect-square bg-gray-600 rounded border-2 border-gray-500 flex flex-col items-center justify-center text-xs ${
                skill ? 'cursor-pointer hover:border-yellow-400' : ''
              }`}
              title={skill?.description || '空'}
            >
              {skill ? (
                <>
                  <span className="text-white text-center px-1 text-xs">{skill.name}</span>
                  {skill.cost && (
                    <span className="text-blue-400 text-[9px]">{skill.cost}MP</span>
                  )}
                </>
              ) : (
                <span className="text-gray-600 text-xs">空</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Spells;
