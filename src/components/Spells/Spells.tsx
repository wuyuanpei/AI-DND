import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

const Spells: React.FC = () => {
  const { skills, mp, maxMp } = usePlayerStore();

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-white text-sm font-bold mb-2 border-b border-gray-600 pb-1">
        技能/法术
      </h3>
      <div className="text-xs text-blue-400 mb-2">
        MP: {mp}/{maxMp}
      </div>
      <div className="flex-1 overflow-y-auto">
        {skills.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">
            暂无技能
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-gray-600 rounded p-2 mb-1 text-xs cursor-pointer hover:bg-gray-500"
            >
              <div className="text-white">{skill.name}</div>
              <div className="text-gray-400">{skill.description}</div>
              {skill.cost && (
                <div className="text-blue-400">消耗: {skill.cost} MP</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Spells;