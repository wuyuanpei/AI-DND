import React from 'react';
import { usePlayerStore, INVENTORY_SLOTS } from '../../store/playerStore';
import type { Item } from '../../types';

const Inventory: React.FC = () => {
  const { inventory, weightLimit } = usePlayerStore();

  // 计算当前重量（物品数量）
  const currentWeight = Object.keys(inventory).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-600 pb-1 mb-2 flex-shrink-0">
        <h3 className="text-white text-lg font-bold">背包</h3>
        <span className="text-sm text-gray-400">{currentWeight} / {weightLimit} kg</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* 4 列 7 行 = 28 格 */}
        <div className="grid grid-cols-4 gap-2 content-start">
          {Array.from({ length: INVENTORY_SLOTS }).map((_, idx) => {
            const item = inventory[idx] as Item | undefined;
            return (
              <div
                key={idx}
                className={`aspect-square bg-gray-600 rounded border-2 border-gray-500 flex items-center justify-center ${
                  item ? 'cursor-pointer hover:border-yellow-400' : ''
                }`}
                title={item?.name || '空'}
              >
                {item ? (
                  <span className="text-sm text-white text-center px-1">{item.name}</span>
                ) : (
                  <span className="text-gray-600 text-sm">空</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
