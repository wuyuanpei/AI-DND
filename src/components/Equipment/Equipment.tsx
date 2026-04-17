import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

const Equipment: React.FC = () => {
  const { equipment } = usePlayerStore();

  // 2x3 装备槽
  const slots = [
    { key: 'helmet', label: '头盔', item: equipment.helmet },
    { key: 'chest', label: '护甲', item: equipment.chest },
    { key: 'shield', label: '盾牌', item: equipment.shield },
    { key: 'mainWeapon', label: '主武', item: equipment.mainWeapon },
    { key: 'offWeapon', label: '副武', item: equipment.offWeapon },
    { key: 'ranged', label: '远程', item: equipment.ranged },
  ];

  return (
    <div className="flex flex-col">
      <h3 className="text-white text-lg font-bold mb-2 border-b border-gray-600 pb-1 flex-shrink-0">
        装备
      </h3>
      <div>
        <div className="grid grid-cols-3 gap-1.5 content-start">
          {slots.map(({ key, label, item }) => (
            <div
              key={key}
              className={`aspect-square bg-gray-600 rounded border-2 border-gray-500 flex items-center justify-center ${
                item ? 'cursor-pointer hover:border-yellow-400' : ''
              }`}
              title={item?.name || '空'}
            >
              {item ? (
                <span className="text-sm text-white text-center px-1">{item.name}</span>
              ) : (
                <span className="text-gray-500 text-sm">{label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Equipment;
