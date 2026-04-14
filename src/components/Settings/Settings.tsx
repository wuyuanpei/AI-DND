import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const Settings: React.FC = () => {
  const { deepseekApiKey, setApiKey } = useSettingsStore();
  const [inputKey, setInputKey] = useState(deepseekApiKey || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    setApiKey(inputKey);
    setIsOpen(false);
  };

  return (
    <>
      {/* 设置按钮 - 始终在右上角 */}
      <button
        className="fixed top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        ⚙ 设置
      </button>

      {/* 设置面板 - 模态框 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-600">
            <div className="text-white font-bold text-lg mb-4">设置</div>

            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">
                DeepSeek API Key
              </label>
              <input
                type="password"
                className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                placeholder="输入你的 API Key..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
              />
            </div>

            <div className="text-xs text-gray-500 mb-4">
              从{' '}
              <a
                href="https://platform.deepseek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                platform.deepseek.com
              </a>{' '}
              获取 API Key
            </div>

            <div className="flex gap-2 justify-end">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
                onClick={() => setIsOpen(false)}
              >
                取消
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded"
                onClick={handleSave}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Settings;
