import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { Item } from '../../types';

const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case 'common': return 'border-gray-400';
    case 'rare': return 'border-blue-400';
    case 'epic': return 'border-purple-400';
    case 'legendary': return 'border-yellow-400';
    default: return 'border-gray-500';
  }
};

const getRarityTextColor = (rarity: string): string => {
  switch (rarity) {
    case 'common': return 'text-gray-400';
    case 'rare': return 'text-blue-400';
    case 'epic': return 'text-purple-400';
    case 'legendary': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
};

const getRarityLabel = (rarity: string): string => {
  switch (rarity) {
    case 'common': return '普通';
    case 'rare': return '稀有';
    case 'epic': return '史诗';
    case 'legendary': return '传说';
    default: return '普通';
  }
};

const Inventory: React.FC = () => {
  const { inventory, equipItem, organizeInventory } = usePlayerStore();
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 构建 slot -> item 映射，并计算堆叠数量
  const slotItems: Record<number, Item> = {};
  const itemCounts: Record<string, number> = {};
  for (const [slotStr, item] of Object.entries(inventory)) {
    if (!item) continue;
    const slot = Number(slotStr);
    slotItems[slot] = item;
    itemCounts[item.id] = (itemCounts[item.id] ?? 0) + 1;
  }

  const shownSlots = new Set<number>(Object.keys(slotItems).map(Number));
  const slotKeys = Object.keys(slotItems).map(Number);
  const maxSlot = slotKeys.length > 0 ? Math.max(...slotKeys) : 0;
  const minSlots = 30;
  const totalSlots = Math.max(minSlots, maxSlot + 1);

  const updateTooltipPosition = useCallback((slotEl: HTMLElement) => {
    const rect = slotEl.getBoundingClientRect();
    setTooltipPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (hoveredSlot !== null) {
      const el = containerRef.current?.querySelector(`[data-slot="${hoveredSlot}"]`) as HTMLElement | null;
      if (el) updateTooltipPosition(el);
    }
  }, [hoveredSlot, updateTooltipPosition]);

  const handleEquip = (slot: number, equipType: 'mainWeapon' | 'offWeapon' | 'ranged' | 'helmet' | 'chest' | 'shield') => {
    const item = inventory[slot];
    if (!item) return;
    const itemCopy: Item = { ...item, type: equipType };
    equipItem(itemCopy, slot);
    setHoveredSlot(null);
  };

  const handleMouseEnterSlot = useCallback((slot: number) => {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredSlot(slot);
    }, 1000);
  }, []);

  const handleMouseLeaveSlot = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTimeout(() => {
      if (!tooltipRef.current?.matches(':hover')) {
        setHoveredSlot(null);
      }
    }, 100);
  }, []);

  const handleMouseLeaveTooltip = useCallback(() => {
    setTimeout(() => {
      if (!containerRef.current?.querySelector('[data-slot]:hover')) {
        setHoveredSlot(null);
      }
    }, 100);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-600 pb-1 mb-2 flex-shrink-0">
        <h3 className="text-white text-lg font-bold">背包<span className="text-gray-500 text-[10px] font-normal ml-1">鼠标悬浮查看详情</span></h3>
        <button
          className="bg-gray-500/50 hover:bg-gray-500/80 text-gray-300 text-xs px-2 py-1 rounded transition-colors cursor-pointer"
          onClick={organizeInventory}
        >
          整理
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative"
      >
        <div className="grid grid-cols-3 gap-2 content-start">
          {Array.from({ length: totalSlots }).map((_, idx) => {
            const item = slotItems[idx];
            if (!item) {
              return (
                <div
                  key={idx}
                  className="aspect-square bg-gray-700 rounded border border-gray-600 flex items-center justify-center"
                >
                  <span className="text-gray-600 text-sm">空</span>
                </div>
              );
            }

            const count = itemCounts[item.id] ?? 1;
            const rarityBorder = getRarityColor(item.rarity ?? '');

            return (
              <div
                key={idx}
                data-slot={idx}
                className="relative"
                onMouseEnter={() => handleMouseEnterSlot(idx)}
                onMouseLeave={handleMouseLeaveSlot}
              >
                <div className={`aspect-square bg-gray-700 rounded border-2 ${rarityBorder} flex flex-col items-center justify-center cursor-pointer hover:brightness-110 transition`}>
                  {item.icon ? (
                    <div className="relative">
                      <img src={`/${item.icon}`} alt={item.name} className="w-12 h-12 object-contain" />
                      <span className="absolute bottom-0 right-0 text-[11px] text-white font-bold bg-black/90 rounded px-0.5 leading-tight shadow">
                        x{count}
                      </span>
                      {(() => {
                        const isMelee = item.weaponType === 'melee';
                        const isRanged = item.weaponType === 'ranged';
                        if (isMelee || isRanged) {
                          return (
                            <span className="absolute top-0 right-0 text-[9px] font-bold bg-red-800/90 text-red-100 rounded px-0.5 leading-tight shadow">
                              ⚔{item.damage}
                            </span>
                          );
                        }
                        if (item.type === 'helmet' && item.damageReduction !== undefined) {
                          return (
                            <span className="absolute top-0 right-0 text-[9px] font-bold bg-amber-800/90 text-amber-100 rounded px-0.5 leading-tight shadow">
                              🛡{Math.round(item.damageReduction * 100)}%
                            </span>
                          );
                        }
                        if (item.type === 'chest' && item.bonusHp !== undefined) {
                          return (
                            <span className="absolute top-0 right-0 text-[9px] font-bold bg-green-800/90 text-green-100 rounded px-0.5 leading-tight shadow">
                              ❤{item.bonusHp}
                            </span>
                          );
                        }
                        if (item.type === 'shield' && item.defense !== undefined) {
                          return (
                            <span className="absolute top-0 right-0 text-[9px] font-bold bg-blue-800/90 text-blue-100 rounded px-0.5 leading-tight shadow">
                              🛡{item.defense}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-lg">?</span>
                  )}
                  <span className="text-white text-[11px] text-center leading-tight mt-0.5 px-1">{item.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip 使用 fixed 定位，pointer-events-auto 允许交互 */}
      {hoveredSlot !== null && tooltipPos && (() => {
        const item = inventory[hoveredSlot] as Item | undefined;
        if (!item) return null;
        const isMelee = item.weaponType === 'melee';
        const isRanged = item.weaponType === 'ranged';
        const isHelmet = item.type === 'helmet';
        const isChest = item.type === 'chest';
        const isShield = item.type === 'shield';
        const isArmor = isHelmet || isChest || isShield;
        const typeLabel = isMelee ? '近战武器' : isRanged ? '远程武器' : isHelmet ? '头盔' : isChest ? '护甲' : isShield ? '盾牌' : '护甲';
        return (
          <div
            ref={tooltipRef}
            className="fixed w-64 bg-gray-900 border border-gray-500 rounded-lg shadow-xl p-3 z-[9999]"
            style={{ top: tooltipPos.top, left: tooltipPos.left, transform: 'translateX(-50%)' }}
            onMouseLeave={handleMouseLeaveTooltip}
          >
            <div className="flex items-center gap-2 mb-1">
              {item.icon && <img src={`/${item.icon}`} alt="" className="w-8 h-8 object-contain" />}
              <div>
                <div className="text-white font-semibold text-sm">{item.name}</div>
                {item.rarity && (
                  <div className={`text-xs ${getRarityTextColor(item.rarity)}`}>{getRarityLabel(item.rarity)}</div>
                )}
              </div>
            </div>
            {item.description && <div className="text-gray-300 text-xs mb-1.5">{item.description}</div>}
            <div className="text-gray-400 text-xs space-y-0.5">
              <div>类型: {typeLabel}</div>
              {item.damage && <div>伤害: {item.damage}</div>}
              {item.damageReduction !== undefined && <div>伤害减免: {Math.round(item.damageReduction * 100)}%</div>}
              {item.bonusHp !== undefined && <div>额外生命: +{item.bonusHp}</div>}
              {item.defense !== undefined && <div>防御: {item.defense}</div>}
              {item.durability !== undefined && <div>持久度: {item.durability} / {item.maxDurability ?? item.durability}</div>}
              {item.effect && <div className="text-green-400">特效: {item.effect}</div>}
              {item.price !== undefined && <div>价格: {item.price} 金币（出售价 {Math.floor(item.price * 0.6)} 金币）</div>}
            </div>
            {(isMelee || isRanged) && (
              <div className="mt-2 pt-2 border-t border-gray-700 flex gap-1.5">
                {isMelee && (
                  <button
                    className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                    onClick={() => handleEquip(hoveredSlot, 'mainWeapon')}
                  >
                    装备主武
                  </button>
                )}
                {isMelee && (
                  <button
                    className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                    onClick={() => handleEquip(hoveredSlot, 'offWeapon')}
                  >
                    装备副武
                  </button>
                )}
                {isRanged && (
                  <button
                    className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                    onClick={() => handleEquip(hoveredSlot, 'ranged')}
                  >
                    装备远程
                  </button>
                )}
              </div>
            )}
            {isHelmet && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <button
                  className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                  onClick={() => handleEquip(hoveredSlot, 'helmet')}
                >
                  装备头盔
                </button>
              </div>
            )}
            {isChest && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <button
                  className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                  onClick={() => handleEquip(hoveredSlot, 'chest')}
                >
                  装备护甲
                </button>
              </div>
            )}
            {isShield && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <button
                  className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                  onClick={() => handleEquip(hoveredSlot, 'shield')}
                >
                  装备盾牌
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default Inventory;
