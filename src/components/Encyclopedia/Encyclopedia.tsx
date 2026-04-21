import React, { useState } from 'react';
import weaponsData from '../../data/weapons.json';
import armorsData from '../../data/armors.json';
import monstersData from '../../data/monsters.json';
import type { Rarity, WeaponPreset, ArmorPreset, Monster } from '../../types';
import { RARITY_LABELS } from '../../types';

const weapons = weaponsData.weapons as WeaponPreset[];
const armors = armorsData.armors as ArmorPreset[];
const monsters = monstersData.monsters as Monster[];

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
  { id: 'melee', label: '近战' },
  { id: 'ranged', label: '远程' },
  { id: 'helmet', label: '头盔' },
  { id: 'chest', label: '护甲' },
  { id: 'shield', label: '盾牌' },
  { id: 'monster', label: '怪物' },
] as const;

type TabId = typeof tabs[number]['id'];

const armorTypeName: Record<string, string> = {
  helmet: '头盔',
  chest: '护甲',
  shield: '盾牌',
};

const Encyclopedia: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('melee');

  const isMonsterTab = activeTab === 'monster';

  const allItems = [
    ...weapons.map((w) => ({ ...w, category: w.weaponType as string })),
    ...armors.map((a) => ({ ...a, category: a.armorType as string })),
  ];

  const filtered = allItems
    .filter((item) => {
      return item.category === activeTab;
    })
    .sort((a, b) => {
      const rDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (rDiff !== 0) return rDiff;
      return a.price - b.price;
    });

  const filteredMonsters = activeTab === 'monster'
    ? [...monsters].sort((a, b) => {
        const rDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        if (rDiff !== 0) return rDiff;
        return a.hp - b.hp;
      })
    : [];

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
              <div className="text-white font-bold text-xl">{isMonsterTab ? '怪物图鉴' : '装备图鉴'}</div>
              <button
                className="text-gray-400 hover:text-white text-xl leading-none"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {/* Tab 导航 */}
            <div className="flex border-b border-gray-600 flex-shrink-0 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
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
              {isMonsterTab ? (
                filteredMonsters.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredMonsters.map((monster) => (
                    <div
                      key={monster.id}
                      className={`bg-gray-700 rounded-lg p-4 flex gap-4 border ${rarityBorderColors[monster.rarity]} hover:bg-gray-650 transition-colors`}
                    >
                      {/* 图标 */}
                      <div className="w-20 h-20 flex-shrink-0 rounded overflow-hidden border border-gray-500 bg-gray-600">
                        <img
                          src={`/${monster.icon}`}
                          alt={monster.name}
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
                          <span className={`font-bold text-base ${rarityNameColors[monster.rarity]}`}>
                            {monster.name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${rarityBadgeColors[monster.rarity]}`}>
                            {RARITY_LABELS[monster.rarity]}
                          </span>
                        </div>

                        {/* 属性 */}
                        <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                          <span>❤️ HP <span className="text-red-400 font-medium">{monster.hp}</span></span>
                          <span>🛡️ 防御 <span className="text-blue-400 font-medium">{monster.defense}</span></span>
                          <span>📜 经验 <span className="text-green-400 font-medium">{monster.expReward}</span></span>
                        </div>
                        <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                          <span>💪 力量 <span className="text-orange-400 font-medium">{monster.strength}</span></span>
                          <span>⚡ 敏捷 <span className="text-green-400 font-medium">{monster.agility}</span></span>
                          <span>🧠 智力 <span className="text-purple-400 font-medium">{monster.intelligence}</span></span>
                          <span>✨ 魅力 <span className="text-yellow-400 font-medium">{monster.charisma}</span></span>
                        </div>

                        {/* 描述 */}
                        <div className="text-sm text-gray-400 leading-relaxed mb-2">
                          {monster.description}
                        </div>

                        {/* 技能 */}
                        {monster.skills.length > 0 && (
                          <div className="space-y-1">
                            {monster.skills.map((skill, idx) => (
                              <div key={idx} className="text-xs bg-gray-800 rounded px-2 py-1.5 border border-gray-600">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-yellow-300 font-medium">{skill.name}</span>
                                  <span className={`text-xs px-1 rounded ${skill.rangeType === 'melee' ? 'bg-red-900/40 text-red-300' : 'bg-blue-900/40 text-blue-300'}`}>
                                    {skill.rangeType === 'melee' ? '近战' : '远程'}
                                  </span>
                                  {skill.damage !== '0' && (
                                    <span className="text-orange-300 font-medium">💥 {skill.damage}</span>
                                  )}
                                </div>
                                <div className="text-gray-500">{skill.description}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <div className="text-gray-500 text-center py-12">暂无怪物数据</div>
                )
              ) : filtered.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filtered.map((item) => {
                  const isWeapon = 'weaponType' in item;
                  const weapon = isWeapon ? item as WeaponPreset : null;
                  const armor = !isWeapon ? item as ArmorPreset : null;

                  return (
                    <div
                      key={item.id}
                      className={`bg-gray-700 rounded-lg p-4 flex gap-4 border ${rarityBorderColors[item.rarity]} hover:bg-gray-650 transition-colors`}
                    >
                      {/* 图标 */}
                      <div className="w-20 h-20 flex-shrink-0 rounded overflow-hidden border border-gray-500 bg-gray-600">
                        <img
                          src={`/${item.icon}`}
                          alt={item.name}
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
                            className={`font-bold text-base ${rarityNameColors[item.rarity]}`}
                          >
                            {item.name}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${rarityBadgeColors[item.rarity]}`}
                          >
                            {RARITY_LABELS[item.rarity]}
                          </span>
                        </div>

                        {/* 类型 */}
                        <div className="text-xs text-gray-400 mb-1.5">
                          {isWeapon
                            ? (weapon!.weaponType === 'melee' ? '近战武器' : '远程武器')
                            : armorTypeName[armor!.armorType]}
                        </div>

                        {/* 属性 */}
                        {isWeapon ? (
                          <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                            <span>💥 伤害 <span className="text-white font-medium">{weapon!.damage}</span></span>
                            <span>🔧 持久 <span className="text-white font-medium">{weapon!.durability}</span></span>
                            <span>💰 价格 <span className="text-yellow-300 font-medium">{weapon!.price}</span></span>
                          </div>
                        ) : armor!.armorType === 'helmet' ? (
                          <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                            {armor!.damageReduction !== undefined && (
                              <span>🔻 减伤 <span className="text-white font-medium">{Math.round(armor!.damageReduction * 100)}%</span></span>
                            )}
                            <span>🔧 持久 <span className="text-white font-medium">{armor!.durability}</span></span>
                            <span>💰 价格 <span className="text-yellow-300 font-medium">{armor!.price}</span></span>
                          </div>
                        ) : armor!.armorType === 'chest' ? (
                          <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                            {armor!.bonusHp !== undefined && (
                              <span>❤️ 生命 <span className="text-white font-medium">+{armor!.bonusHp}</span></span>
                            )}
                            <span>💰 价格 <span className="text-yellow-300 font-medium">{armor!.price}</span></span>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-300 space-x-3 mb-1.5">
                            {armor!.defense !== undefined && (
                              <span>🛡️ 防御 <span className="text-white font-medium">{armor!.defense}</span></span>
                            )}
                            <span>🔧 持久 <span className="text-white font-medium">{armor!.durability}</span></span>
                            <span>💰 价格 <span className="text-yellow-300 font-medium">{armor!.price}</span></span>
                          </div>
                        )}

                        {/* 描述 */}
                        <div className="text-sm text-gray-400 leading-relaxed">
                          {item.description}
                        </div>

                        {/* 特殊效果 */}
                        {item.effect && (
                          <div className="mt-2 text-sm text-green-400 bg-green-900/20 border border-green-700/30 rounded px-2 py-1">
                            ✦ {item.effect}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              ) : (
                <div className="text-gray-500 text-center py-12">暂无装备数据</div>
              )
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Encyclopedia;
