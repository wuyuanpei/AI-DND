import React, { useState, useEffect } from 'react';
import { logSystem } from '../../store/logStore';
import { loadPlayerJson, type PlayerJson } from '../../utils/playerDB';

interface MemoryEntry {
  key: string;
  title: string;
  data: PlayerJson;
  updatedAt: string;
}

const MEMORY_KEYS = [
  { key: 'ai-dnd-player-md', title: '玩家卡片', loader: loadPlayerJson },
];

const Memory: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    (async () => {
      const loaded: MemoryEntry[] = [];
      for (const meta of MEMORY_KEYS) {
        const raw: PlayerJson | null = await meta.loader();
        if (raw) {
          loaded.push({
            key: meta.key,
            title: meta.title,
            data: raw,
            updatedAt: new Date().toLocaleString('zh-CN'),
          });
        }
      }
      logSystem('记忆面板读取', `读取了 ${loaded.length} 条记忆记录`);
      setEntries(loaded);
      if (loaded.length > 0) {
        setSelectedKey(loaded[0].key);
      } else {
        setSelectedKey(null);
      }
    })();
  }, [isOpen]);

  const selectedEntry = entries.find((e) => e.key === selectedKey);

  return (
    <>
      {/* 记忆按钮 - 在日志按钮左边 */}
      <button
        className="fixed top-4 right-64 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded shadow-lg z-10"
        onClick={() => setIsOpen(true)}
      >
        🧠 记忆
      </button>

      {/* 记忆面板 - 模态框 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gray-800 rounded-lg w-[90vw] max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-gray-600 z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <div className="text-white font-bold text-lg">记忆</div>
              <button
                className="text-gray-400 hover:text-white text-xl leading-none"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* 左侧列表 */}
              <div className="w-40 border-r border-gray-600 overflow-y-auto p-2 space-y-1">
                {entries.length === 0 ? (
                  <div className="text-gray-500 text-xs text-center py-4">暂无记忆</div>
                ) : (
                  entries.map((entry) => (
                    <button
                      key={entry.key}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded ${
                        selectedKey === entry.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      onClick={() => setSelectedKey(entry.key)}
                    >
                      {entry.title}
                    </button>
                  ))
                )}
              </div>

              {/* 右侧详情 */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedEntry ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-gray-400 text-xs">{selectedEntry.title}</div>
                      <div className="text-gray-500 text-[10px]">{selectedEntry.updatedAt}</div>
                    </div>

                    <div className="bg-gray-700/50 rounded-lg p-4 space-y-4 border border-gray-600/50">
                      <div>
                        <div className="text-xl font-bold text-white">{selectedEntry.data.name}</div>
                        {selectedEntry.data.gender ? (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-200 border border-blue-500/30">
                            {selectedEntry.data.gender}
                          </span>
                        ) : null}
                      </div>

                      <div className="h-px bg-gray-600/50" />

                      {selectedEntry.data.appearance ? (
                        <div>
                          <div className="text-xs font-semibold text-yellow-500 mb-1">外貌</div>
                          <div className="text-sm text-gray-200 leading-relaxed">{selectedEntry.data.appearance}</div>
                        </div>
                      ) : null}

                      {selectedEntry.data.personality ? (
                        <div>
                          <div className="text-xs font-semibold text-green-500 mb-1">性格</div>
                          <div className="text-sm text-gray-200 leading-relaxed">{selectedEntry.data.personality}</div>
                        </div>
                      ) : null}

                      {selectedEntry.data.backstory ? (
                        <div>
                          <div className="text-xs font-semibold text-purple-500 mb-1">背景</div>
                          <div className="text-sm text-gray-200 leading-relaxed">{selectedEntry.data.backstory}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm text-center py-8">暂无记忆内容</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Memory;
