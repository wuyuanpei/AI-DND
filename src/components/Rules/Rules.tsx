import React, { useState } from 'react';
import rulesData from '../../data/rules.json';

interface Tab {
  id: string;
  label: string;
  content: string;
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
        className="fixed top-4 right-24 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        📜 规则
      </button>

      {/* 规则面板 - 模态框 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full mx-4 shadow-2xl border border-gray-600 flex flex-col max-h-[80vh]">
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <div className="text-white font-bold text-lg">游戏规则</div>
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

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4">
              {currentTab && (
                <div className="text-gray-300 text-sm whitespace-pre-line">
                  {currentTab.content}
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <div className="p-4 border-t border-gray-600 flex justify-end">
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded"
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
