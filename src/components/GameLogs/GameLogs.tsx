import React, { useState } from 'react';
import { useLogStore } from '../../store/logStore';
import type { GameLogCategory, LogLevel } from '../../store/logStore';

const CATEGORIES: { value: GameLogCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'api', label: 'API' },
  { value: 'system', label: '系统' },
  { value: 'ui', label: 'UI' },
  { value: 'combat', label: '战斗' },
  { value: 'world', label: '世界' },
  { value: 'memory', label: '记忆' },
];

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const CATEGORY_COLORS: Record<GameLogCategory, string> = {
  api: 'bg-blue-900 text-blue-300',
  system: 'bg-gray-700 text-gray-300',
  ui: 'bg-purple-900 text-purple-300',
  combat: 'bg-red-900 text-red-300',
  world: 'bg-green-900 text-green-300',
  memory: 'bg-yellow-900 text-yellow-300',
};

const GameLogs: React.FC = () => {
  const { logs, clearLogs } = useLogStore();
  const [isOpen, setIsOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<GameLogCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = filterCategory === 'all'
    ? logs
    : logs.filter((log) => log.category === filterCategory);

  const handleCopyLog = async (e: React.MouseEvent, log: typeof logs[0]) => {
    e.stopPropagation();
    const text = [
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`,
      log.details ? `---\n${log.details.replace(/\\n/g, '\n')}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* 日志按钮 - 在 Rules 按钮旁边 */}
      <button
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        📋 日志
      </button>

      {/* 日志面板 - 模态框 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg w-[95vw] max-w-5xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-600 z-[60]" onClick={(e) => e.stopPropagation()}>
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <div className="text-white font-bold text-xl">游戏系统日志</div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{logs.length} 条</span>
                <button
                  className="text-gray-400 hover:text-red-400 text-sm px-3 py-1.5 rounded border border-gray-600 hover:border-red-400"
                  onClick={() => {
                    clearLogs();
                    setExpandedId(null);
                  }}
                >
                  清空
                </button>
                <button
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            {/* 过滤器 */}
            <div className="flex items-center gap-1 py-3 px-2 border-b border-gray-600 bg-gray-750">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
                    filterCategory === cat.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => setFilterCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 日志列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
              {filteredLogs.length === 0 ? (
                <div className="text-gray-500 text-center text-base py-8">暂无日志</div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded text-sm cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-gray-500 font-mono">{log.timestamp}</span>
                      <span className={`font-bold ${LEVEL_COLORS[log.level]}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLORS[log.category]}`}>
                        {log.category}
                      </span>
                      <span className="text-gray-300 flex-1 whitespace-pre-line">{log.message.replace(/\\n/g, '\n')}</span>
                      <button
                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                          copiedId === log.id
                            ? 'bg-green-700 border-green-600 text-green-100'
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-600'
                        }`}
                        onClick={(e) => handleCopyLog(e, log)}
                      >
                        {copiedId === log.id ? '已复制' : '复制'}
                      </button>
                      {log.details && (
                        <span className="text-gray-500">{expandedId === log.id ? '▼' : '►'}</span>
                      )}
                    </div>
                    {log.details && expandedId === log.id && (
                      <pre className="bg-gray-900 m-0 px-3 py-2 text-gray-400 font-mono whitespace-pre-wrap break-all text-sm overflow-y-auto max-h-[40vh]">
                        {log.details.replace(/\\n/g, '\n')}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameLogs;
