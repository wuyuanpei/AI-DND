import React, { useState, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { Skill } from '../../types';

const DEFAULT_SKILL_SLOTS = 9;
const HOVER_DELAY = 1000; // 1秒延迟

const Spells: React.FC = () => {
  const { skills } = usePlayerStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const learnedCount = skills.length;
  const slotCount = Math.max(DEFAULT_SKILL_SLOTS, learnedCount);
  const skillSlots = Array.from({ length: slotCount }, (_, i) => skills[i]);

  const updateTooltipPosition = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const handleMouseEnterSlot = useCallback((index: number, skill?: Skill) => {
    if (!skill) return;
    setHoveredIndex(index);
    setShowTooltip(false);
    timerRef.current = setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-slot="${index}"]`) as HTMLElement | null;
      if (el) {
        updateTooltipPosition(el);
        setShowTooltip(true);
      }
    }, HOVER_DELAY);
  }, [updateTooltipPosition]);

  const handleMouseLeaveSlot = useCallback(() => {
    setHoveredIndex(null);
    setShowTooltip(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hoveredSkill = hoveredIndex !== null ? skillSlots[hoveredIndex] : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-600 pb-1 mb-2 flex-shrink-0">
        <h3 className="text-white text-lg font-bold">
          技能
          <span className="text-gray-500 text-[10px] font-normal ml-1">鼠标悬浮查看详情</span>
        </h3>
        <span className="text-sm text-gray-400">{learnedCount}</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" ref={containerRef}>
        <div className="grid grid-cols-3 gap-2 content-start">
          {skillSlots.map((skill, idx) => (
            <div
              key={idx}
              data-slot={idx}
              className="relative"
              onMouseEnter={() => handleMouseEnterSlot(idx, skill)}
              onMouseLeave={handleMouseLeaveSlot}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`relative aspect-square w-full rounded-lg border-2 overflow-hidden transition-colors bg-gray-700 flex items-center justify-center ${
                    skill
                      ? 'border-gray-500 cursor-pointer hover:border-yellow-400'
                      : 'border-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {skill ? (
                    <>
                      {skill.icon ? (
                        <img
                          src={`/${skill.icon}`}
                          alt={skill.name}
                          className="w-full h-full object-contain p-0.5 rounded-lg"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">技能</span>
                      )}
                      {skill.damage && (
                        <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-red-800/90 text-red-100 rounded px-1 py-0.5 leading-tight shadow">
                          ⚔{skill.damage}
                        </span>
                      )}
                      {skill.cost && (
                        <span className="absolute top-0.5 right-0.5 text-[10px] font-bold bg-blue-800/90 text-blue-100 rounded px-1 py-0.5 leading-tight shadow">
                          {skill.cost}MP
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm">空</span>
                  )}
                </div>
                {skill && (
                  <span className="text-white text-xs text-center mt-1 truncate w-full px-0.5 leading-tight">
                    {skill.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 悬浮提示 */}
      {showTooltip && hoveredSkill && tooltipPos && (
        <div
          className="fixed z-50 bg-black/90 border border-yellow-500 rounded p-2.5 max-w-[180px] shadow-lg pointer-events-none"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateX(-50%) translateY(-100%)',
          }}
        >
          <div className="text-yellow-400 font-bold text-sm mb-1">{hoveredSkill.name}</div>
          {hoveredSkill.damage && (
            <div className="text-red-400 text-xs mb-1">伤害: {hoveredSkill.damage}</div>
          )}
          {hoveredSkill.cost && (
            <div className="text-blue-400 text-xs mb-1">消耗: {hoveredSkill.cost} MP</div>
          )}
          <div className="text-gray-300 text-xs leading-relaxed">{hoveredSkill.description}</div>
        </div>
      )}
    </div>
  );
};

export default Spells;
