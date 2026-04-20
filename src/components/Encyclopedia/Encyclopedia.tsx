import React, { useState } from 'react';
import weaponsData from '../../data/weapons.json';
import type { Rarity, WeaponPreset } from '../../types';
import { RARITY_LABELS } from '../../types';

const weapons = weaponsData.weapons as WeaponPreset[];

const rarityNameColors: Record<Rarity, string> = {
  common: 'text-gray-300',
  rare: 'text-blue-300',
  epic: 'text-purple-300',
  legendary: 'text-yellow-300',
};

const rarityBorderColors: Record<Rarity, string> = {
  common: 'border-gray-600',
  rare: 'border-blue-600/50',
  epic: 'border-purple-600/50',
  legendary: 'border-yellow-600/50',
};

const rarityBadgeColors: Record<Rarity, string> = {
  common: 'bg-gray-600 text-gray-200',
  rare: 'bg-blue-600 text-blue-100',
  epic: 'bg-purple-600 text-purple-100',
  legendary: 'bg-yellow-600 text-yellow-100',
};

const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

const tabs = [
  { id: 'all', label: '全部' },
  { id: 'melee', label: '近战' },
  { id: 'ranged', label: '远程' },
] as const;

type TabId = typeof tabs[number]['id'];

const Encyclopedia: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const filtered = weapons
    .filter((w) => {
      if (activeTab === 'all') return true;
      return w.weaponType === activeTab;
    })
    .sort((a, b) => {
      const rDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (rDiff !== 0) return rDiff;
      return a.price - b.price;
    });

  return (
    <>
      <button
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        📖 图鉴
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gray-800 rounded-lg w-[95vw] max-w-5xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-600 z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600 flex-shrink-0">
              <div className="text-white font-bold text-xl">武器图鉴</div>
              <button
                className="text-gray-400 hover:text-white text-xl leading-none"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {/* Tab 导航 */}
            <div className="flex border-b border-gray-600 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'text-yellow-400 border-b-2 border-yellow-400 bg-gray-700'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {filtered.map((weapon) => (
                  <div
                    key={weapon.id}
                    className={`bg-gray-700 rounded-lg p-4 flex gap-4 border ${rarityBorderColors[weapon.rarity]} hover:bg-gray-650 transition-colors`}
                  >
                    {/* 图标 */}
                    <div className="w-20 h-20 flex-shrink-0 rounded overflow-hidden border border-gray-500 bg-gray-600">
                      <img
                        src={`/${weapon.icon}`}
                        alt={weapon.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<span class="flex items-center justify-center w-full h-full text-gray-400 text-xs text-center">暂无<br/>图片</span>';
                          }
                        }}
                      />
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      {/* 名称 + 稀有度 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-bold text-base ${rarityNameColors[weapon.rarity]}`}
                        >
                          {weapon.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${rarityBadgeColors[weapon.rarity]}`}
                        >
                          {RARITY_LABELS[weapon.rarity]}
                        </span>
                      </div>

                      {/* 类型 */}
                      <div className="text-xs text-gray-400 mb-1.5">
                        {weapon.weaponType === 'melee' ? '近战武器' : '远程武器'}
                      </div>

                      {/* 属性 */}
                      <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                        <span>💥 伤害 <span className="text-white font-medium">{weapon.damage}</span></span>
                        <span>🔧 持久 <span className="text-white font-medium">{weapon.durability}</span></span>
                        <span>💰 价格 <span className="text-yellow-300 font-medium">{weapon.price}</span></span>
                      </div>

                      {/* 描述 */}
                      <div className="text-sm text-gray-400 leading-relaxed">
                        {weapon.description}
                      </div>

                      {/* 特殊效果 */}
                      {weapon.effect && (
                        <div className="mt-2 text-sm text-green-400 bg-green-900/20 border border-green-700/30 rounded px-2 py-1">
                          ✦ {weapon.effect}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-gray-500 text-center py-12">暂无武器数据</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Encyclopedia;
