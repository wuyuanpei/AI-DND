import React, { useState } from 'react';
import { useScriptStore } from '../../store/scriptStore';

const ScriptManager: React.FC = () => {
  const { activeScript, parseAndActivate, deactivateScript } = useScriptStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const tabs = [
    { id: 'info', label: '剧本信息' },
    { id: 'acts', label: '幕' },
    { id: 'npcs', label: 'NPC' },
    { id: 'endings', label: '结局' },
    { id: 'dm', label: 'DM 提示词' },
  ];

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const scriptId = `script_${Date.now()}`;
      try {
        parseAndActivate(content, scriptId);
      } catch (err) {
        alert(err instanceof Error ? err.message : '剧本解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <button
        className="fixed top-4 right-64 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded shadow-lg z-10"
        onClick={() => setIsOpen(true)}
      >
        📖 剧本
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full mx-4 shadow-2xl border border-gray-600 flex flex-col max-h-[85vh] z-[60]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <div className="text-white font-bold text-lg">
                剧本管理
                {activeScript && (
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    — {activeScript.title}
                  </span>
                )}
              </div>
              <button
                className="text-gray-400 hover:text-white text-xl"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-gray-600">
              {tabs.map(tab => (
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

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {!activeScript ? (
                    <div className="text-gray-500 text-center py-8 text-sm">
                      当前没有激活的剧本
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-gray-400 text-sm">标题：</span>
                        <span className="text-white">{activeScript.title}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">作者：</span>
                        <span className="text-white">{activeScript.author || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">简介：</span>
                        <span className="text-white">{activeScript.description || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">幕数：</span>
                        <span className="text-white">{activeScript.acts.length} 幕</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">结局数量：</span>
                        <span className="text-white">{activeScript.endings.length} 个</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">NPC 数量：</span>
                        <span className="text-white">{activeScript.npcs.length} 人</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'acts' && (
                <div>
                  {!activeScript || activeScript.acts.length === 0 ? (
                    <div className="text-gray-500 text-center py-8 text-sm">无幕数据</div>
                  ) : (
                    <div className="space-y-4">
                      {activeScript.acts.map(act => (
                        <div key={act.id} className="bg-gray-700 rounded p-4">
                          <div className="text-white font-medium text-sm mb-2">{act.title}</div>
                          {act.synopsis && (
                            <div className="text-gray-400 text-xs mb-3 whitespace-pre-line">{act.synopsis}</div>
                          )}
                          {act.content && (
                            <div className="bg-gray-800 rounded p-3">
                              <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">详细剧情</div>
                              <div className="text-gray-300 text-xs whitespace-pre-line leading-relaxed">{act.content}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'npcs' && (
                <div>
                  {!activeScript || activeScript.npcs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8 text-sm">无 NPC 数据</div>
                  ) : (
                    <div className="space-y-4">
                      {activeScript.npcs.map(npc => (
                        <div key={npc.id} className="bg-gray-700 rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">{npc.name}</span>
                            <span className="text-gray-500 text-xs font-mono">{npc.id}</span>
                          </div>
                          {npc.summary && (
                            <div className="text-gray-300 text-xs mb-3 italic">{npc.summary}</div>
                          )}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="text-center">
                              <div className="text-red-400 text-xs font-bold">{npc.stats.strength}</div>
                              <div className="text-gray-500 text-[10px]">力量</div>
                            </div>
                            <div className="text-center">
                              <div className="text-green-400 text-xs font-bold">{npc.stats.agility}</div>
                              <div className="text-gray-500 text-[10px]">敏捷</div>
                            </div>
                            <div className="text-center">
                              <div className="text-blue-400 text-xs font-bold">{npc.stats.intelligence}</div>
                              <div className="text-gray-500 text-[10px]">智力</div>
                            </div>
                            <div className="text-center">
                              <div className="text-purple-400 text-xs font-bold">{npc.stats.charisma}</div>
                              <div className="text-gray-500 text-[10px]">魅力</div>
                            </div>
                          </div>
                          {npc.personality && (
                            <div className="text-gray-400 text-xs mb-1">
                              <span className="text-gray-500">性格：</span>{npc.personality}
                            </div>
                          )}
                          {npc.background && (
                            <div className="text-gray-400 text-xs mb-1">
                              <span className="text-gray-500">背景：</span>{npc.background}
                            </div>
                          )}
                          {npc.dialogueStyle && (
                            <div className="text-gray-400 text-xs mb-2">
                              <span className="text-gray-500">对话风格：</span>{npc.dialogueStyle}
                            </div>
                          )}
                          {npc.systemPrompt && (
                            <div className="bg-gray-800 rounded p-2 mt-2">
                              <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">系统提示词</div>
                              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans">{npc.systemPrompt}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'endings' && (
                <div>
                  {!activeScript || activeScript.endings.length === 0 ? (
                    <div className="text-gray-500 text-center py-8 text-sm">无结局数据</div>
                  ) : (
                    <div className="space-y-4">
                      {activeScript.endings.map(ending => (
                        <div key={ending.id} className="bg-gray-700 rounded p-4">
                          <div className="text-white font-medium text-sm mb-1">{ending.title}</div>
                          {ending.condition && (
                            <div className="text-yellow-300 text-xs mb-2">
                              <span className="text-gray-500">触发条件：</span>{ending.condition}
                            </div>
                          )}
                          {ending.synopsis && (
                            <div className="text-gray-400 text-xs mb-3 whitespace-pre-line">{ending.synopsis}</div>
                          )}
                          {ending.content && (
                            <div className="bg-gray-800 rounded p-3">
                              <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">结局详情</div>
                              <div className="text-gray-300 text-xs whitespace-pre-line leading-relaxed">{ending.content}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dm' && (
                <div>
                  {!activeScript ? (
                    <div className="text-gray-500 text-center py-8 text-sm">当前没有激活的剧本</div>
                  ) : (
                    <div className="bg-gray-700 rounded p-3">
                      <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                        {activeScript.dmPrompt}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-600 flex items-center justify-between">
              <input
                type="file"
                accept=".md,.markdown,.txt,.yaml,.yml"
                onChange={handleImport}
                className="hidden"
                id="script-file-input"
              />
              <label
                htmlFor="script-file-input"
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded"
              >
                📁 导入剧本
              </label>
              <div className="flex gap-2">
                {activeScript && (
                  <button
                    className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded"
                    onClick={deactivateScript}
                  >
                    停用剧本
                  </button>
                )}
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
                  onClick={() => setIsOpen(false)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScriptManager;
