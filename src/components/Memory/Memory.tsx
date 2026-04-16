import React, { useState, useEffect } from 'react';
import { logSystem } from '../../store/logStore';

interface MemoryEntry {
  key: string;
  title: string;
  content: string;
  updatedAt: string;
}

const MEMORY_KEYS = [
  { key: 'ai-dnd-player-md', title: '玩家卡片' },
];

const Memory: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loaded: MemoryEntry[] = [];
    for (const meta of MEMORY_KEYS) {
      const raw = localStorage.getItem(meta.key);
      if (raw) {
        loaded.push({
          key: meta.key,
          title: meta.title,
          content: raw,
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
                  <div className="space-y-2">
                    <div className="text-gray-400 text-xs">{selectedEntry.title}</div>
                    <pre className="bg-gray-900 text-gray-300 text-xs p-3 rounded whitespace-pre-wrap break-all font-mono">
                      {selectedEntry.content}
                    </pre>
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
