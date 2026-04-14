import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

const Equipment: React.FC = () => {
  const { equipment } = usePlayerStore();

  const slots = [
    { key: 'helmet', label: '头盔', item: equipment.helmet },
    { key: 'armor', label: '盔甲', item: equipment.armor },
    { key: 'weapon', label: '武器', item: equipment.weapon },
    { key: 'boots', label: '靴子', item: equipment.boots },
  ];

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-white text-sm font-bold mb-2 border-b border-gray-600 pb-1">
        装备
      </h3>
      <div className="flex-1 grid grid-cols-2 gap-2">
        {slots.map(({ key, label, item }) => (
          <div
            key={key}
            className="bg-gray-600 rounded p-2 flex flex-col items-center justify-center text-xs"
          >
            <span className="text-gray-400">{label}</span>
            {item ? (
              <span className="text-white mt-1">{item.name}</span>
            ) : (
              <span className="text-gray-500 mt-1">空</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Equipment;