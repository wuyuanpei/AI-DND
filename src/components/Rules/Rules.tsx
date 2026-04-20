import React, { useState } from 'react';
import rulesData from '../../data/rules.json';

interface Tab {
  id: string;
  label: string;
  content: string;
}

// Parse markdown table lines into { headers: string[], rows: string[][] }
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const headers = lines[0].split('|').map(c => c.trim()).filter(c => c.length > 0);
  // Skip separator line (line 1)
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length > 0) rows.push(cells);
  }
  if (headers.length === 0 || rows.length === 0) return null;
  return { headers, rows };
}

// Render content by splitting into text blocks and table blocks
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let textBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let keyIdx = 0;

  const flushText = () => {
    if (textBuffer.length > 0) {
      const text = textBuffer.join('\n');
      if (text.trim()) {
        elements.push(
          <div key={`text-${keyIdx++}`} className="text-gray-300 text-base whitespace-pre-line mb-3">
            {text}
          </div>
        );
      }
      textBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const parsed = parseMarkdownTable(tableBuffer);
      if (parsed) {
        elements.push(
          <div key={`table-${keyIdx++}`} className="overflow-x-auto mb-4">
            <table className="w-full text-sm text-left text-gray-300 border border-gray-600">
              <thead className="bg-gray-700 text-gray-100">
                <tr>
                  {parsed.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 border border-gray-600 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border border-gray-600">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      } else {
        // Fallback: render as text if parsing failed
        textBuffer.push(...tableBuffer);
        flushText();
      }
      tableBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      flushText();
      tableBuffer.push(trimmed);
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }
  flushText();
  flushTable();

  return elements;
}

const Rules: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('skills');

  const tabs = rulesData.tabs as Tab[];
  const currentTab = tabs.find(t => t.id === activeTab);

  return (
    <>
      {/* 规则按钮 - 设置按钮左边 */}
      <button
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        📜 规则
      </button>

      {/* 规则面板 - 模态框 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg max-w-5xl w-[95vw] mx-4 shadow-2xl border border-gray-600 flex flex-col max-h-[85vh] z-[60]" onClick={(e) => e.stopPropagation()}>
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <div className="text-white font-bold text-xl">游戏规则</div>
              <button
                className="text-gray-400 hover:text-white text-xl"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Tab 导航 */}
            <div className="flex border-b border-gray-600">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-base font-medium ${
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

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4">
              {currentTab && (
                <div>
                  {renderContent(currentTab.content)}
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <div className="p-4 border-t border-gray-600 flex justify-end">
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-base px-5 py-2.5 rounded"
                onClick={() => setIsOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Rules;
