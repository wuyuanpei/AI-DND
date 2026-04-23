import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { Equipment as EquipmentType } from '../../types';

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

const SLOT_LABELS: Record<string, string> = {
  helmet: '头盔',
  chest: '护甲',
  shield: '盾牌',
  mainWeapon: '主武',
  offWeapon: '副武',
  ranged: '远程',
};

const Equipment: React.FC = () => {
  const { equipment, unequipItem } = usePlayerStore();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterSlot = useCallback((key: string) => {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredKey(key);
    }, 1000);
  }, []);

  const handleMouseLeaveSlot = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTimeout(() => {
      if (!tooltipRef.current?.matches(':hover')) {
        setHoveredKey(null);
      }
    }, 100);
  }, []);

  const handleMouseLeaveTooltip = useCallback(() => {
    setTimeout(() => {
      if (!containerRef.current?.querySelector('[data-slot]:hover')) {
        setHoveredKey(null);
      }
    }, 100);
  }, []);

  const updateTooltipPosition = useCallback((slotEl: HTMLElement) => {
    const rect = slotEl.getBoundingClientRect();
    setTooltipPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (hoveredKey !== null) {
      const el = containerRef.current?.querySelector(`[data-slot="${hoveredKey}"]`) as HTMLElement | null;
      if (el) updateTooltipPosition(el);
    }
  }, [hoveredKey, updateTooltipPosition]);

  const handleUnequip = (key: string) => {
    unequipItem(key as keyof EquipmentType);
    setHoveredKey(null);
  };

  const slots = Object.entries(SLOT_LABELS).map(([key, label]) => ({
    key,
    label,
    item: equipment[key as keyof EquipmentType],
  }));

  return (
    <div className="flex flex-col">
      <h3 className="text-white text-lg font-bold mb-2 border-b border-gray-600 pb-1 flex-shrink-0">
        装备<span className="text-gray-500 text-[10px] font-normal ml-1">鼠标悬浮查看详情</span>
      </h3>
      <div ref={containerRef}>
        <div className="grid grid-cols-3 gap-2 content-start">
          {slots.map(({ key, label, item }) => (
            <div
              key={key}
              data-slot={key}
              className="relative"
              onMouseEnter={() => item && handleMouseEnterSlot(key)}
              onMouseLeave={handleMouseLeaveSlot}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`relative aspect-square w-full rounded-lg border-2 overflow-hidden transition-colors ${
                    item
                      ? `${getRarityColor(item.rarity ?? '')} cursor-pointer hover:border-yellow-400`
                      : 'border-gray-600 hover:border-yellow-400'
                  } bg-gray-700 flex items-center justify-center`}
                >
                  {item ? (
                    <>
                      {item.icon ? (
                        <img
                          src={`/${item.icon}`}
                          alt={item.name}
                          className="w-full h-full object-contain p-0.5 rounded-lg"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{label}</span>
                      )}
                      {(() => {
                        const isMelee = item.weaponType === 'melee';
                        const isRanged = item.weaponType === 'ranged';
                        if (isMelee || isRanged) {
                          return (
                            <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-red-800/90 text-red-100 rounded px-1 py-0.5 leading-tight shadow">
                              ⚔{item.damage}
                            </span>
                          );
                        }
                        if (item.type === 'helmet' && item.damageReduction !== undefined) {
                          return (
                            <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-amber-800/90 text-amber-100 rounded px-1 py-0.5 leading-tight shadow">
                              🛡{Math.round(item.damageReduction * 100)}%
                            </span>
                          );
                        }
                        if (item.type === 'chest' && item.bonusHp !== undefined) {
                          return (
                            <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-green-800/90 text-green-100 rounded px-1 py-0.5 leading-tight shadow">
                              ❤{item.bonusHp}
                            </span>
                          );
                        }
                        if (item.type === 'shield' && item.defense !== undefined) {
                          return (
                            <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-blue-800/90 text-blue-100 rounded px-1 py-0.5 leading-tight shadow">
                              🛡{item.defense}
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {item.durability !== undefined && (
                        <span className="absolute bottom-0.5 right-0.5 text-[10px] text-white font-bold bg-black/90 rounded px-1 py-0.5 leading-tight shadow">
                          {item.durability}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500 text-sm">{label}</span>
                  )}
                </div>
                {item && (
                  <span className="text-white text-xs text-center mt-1 truncate w-full px-0.5 leading-tight">
                    {item.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredKey !== null && tooltipPos && (() => {
        const item = equipment[hoveredKey as keyof EquipmentType];
        if (!item) return null;
        const isMelee = item.weaponType === 'melee';
        const isRanged = item.weaponType === 'ranged';
        const isHelmet = item.type === 'helmet';
        const isChest = item.type === 'chest';
        const isShield = item.type === 'shield';
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
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                className="w-full bg-orange-700 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
                onClick={() => handleUnequip(hoveredKey)}
              >
                收回背包
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Equipment;
