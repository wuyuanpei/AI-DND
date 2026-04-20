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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-600 pb-1 mb-2 flex-shrink-0">
        <h3 className="text-white text-lg font-bold">技能<span className="text-gray-500 text-[10px] font-normal ml-1">鼠标悬浮查看详情</span></h3>
        <span className="text-sm text-gray-400">{learnedCount} / {skillCap}</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-3 gap-2 content-start">
          {skillSlots.map((skill, idx) => (
            <div
              key={idx}
              className={`aspect-square bg-gray-600 rounded border-2 border-gray-500 flex flex-col items-center justify-center text-sm ${
                skill ? 'cursor-pointer hover:border-yellow-400' : ''
              }`}
              title={skill?.description || '空'}
            >
              {skill ? (
                <>
                  <span className="text-white text-center px-1 text-sm">{skill.name}</span>
                  {skill.cost && (
                    <span className="text-blue-400 text-xs">{skill.cost}MP</span>
                  )}
                </>
              ) : (
                <span className="text-gray-600 text-sm">空</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Spells;
