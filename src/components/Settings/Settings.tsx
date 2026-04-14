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

  if (!isOpen) {
    return (
      <button
        className="text-gray-400 hover:text-white text-xs"
        onClick={() => setIsOpen(true)}
      >
        ⚙ 设置
      </button>
    );
  }

  return (
    <div className="bg-gray-600 rounded p-3 text-sm">
      <div className="text-white font-bold mb-2">设置</div>

      <div className="mb-2">
        <label className="text-gray-400 text-xs block mb-1">
          DeepSeek API Key
        </label>
        <input
          type="password"
          className="w-full bg-gray-700 text-white text-xs p-2 rounded border border-gray-500 focus:border-blue-400 outline-none"
          placeholder="输入你的API Key..."
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
        />
      </div>

      <div className="text-xs text-gray-500 mb-2">
        从 platform.deepseek.com 获取API Key
      </div>

      <div className="flex gap-2">
        <button
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded"
          onClick={handleSave}
        >
          保存
        </button>
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded"
          onClick={() => setIsOpen(false)}
        >
          关闭
        </button>
      </div>
    </div>
  );
};

export default Settings;