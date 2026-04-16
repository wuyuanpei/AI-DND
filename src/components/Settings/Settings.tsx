import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const QWEN_MODELS = [
  'qwen3.5-flash',
  'qwen3.6-plus',
  'qwen3.5-plus',
  'qwen3-max',
];

const DEEPSEEK_MODELS = [
  'deepseek-chat',
];

const Settings: React.FC = () => {
  const {
    provider, qwenApiKey, deepseekApiKey, qwenModel, deepseekModel,
    imageApiKey, imageModel, imageApiUrl,
    setProvider, setApiKey, setModel, setImageConfig
  } = useSettingsStore();
  const [inputQwenKey, setInputQwenKey] = useState(qwenApiKey || '');
  const [inputDeepseekKey, setInputDeepseekKey] = useState(deepseekApiKey || '');
  const [selectedQwenModel, setSelectedQwenModel] = useState(qwenModel);
  const [selectedDeepseekModel, setSelectedDeepseekModel] = useState(deepseekModel);
  const [inputImageKey, setInputImageKey] = useState(imageApiKey || '');
  const [inputImageModel, setInputImageModel] = useState(imageModel);
  const [inputImageUrl, setInputImageUrl] = useState(imageApiUrl);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInputQwenKey(qwenApiKey || '');
    setInputDeepseekKey(deepseekApiKey || '');
    setSelectedQwenModel(qwenModel);
    setSelectedDeepseekModel(deepseekModel);
    setInputImageKey(imageApiKey || '');
    setInputImageModel(imageModel);
    setInputImageUrl(imageApiUrl);
  }, [isOpen, qwenApiKey, deepseekApiKey, qwenModel, deepseekModel, imageApiKey, imageModel, imageApiUrl]);

  const handleSave = () => {
    setApiKey('qwen', inputQwenKey);
    setApiKey('deepseek', inputDeepseekKey);
    if (selectedQwenModel !== qwenModel) {
      setModel('qwen', selectedQwenModel);
    }
    if (selectedDeepseekModel !== deepseekModel) {
      setModel('deepseek', selectedDeepseekModel);
    }
    setImageConfig({
      apiKey: inputImageKey,
      model: inputImageModel,
      apiUrl: inputImageUrl,
    });
    setIsOpen(false);
  };

  return (
    <>
      <button
        className="fixed top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded shadow-lg z-10"
        onClick={() => setIsOpen(true)}
      >
        ⚙ 设置
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-600 z-[60]" onClick={(e) => e.stopPropagation()}>
            <div className="text-white font-bold text-lg mb-4">设置</div>

            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">
                服务商
              </label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 text-sm p-3 rounded border ${
                    provider === 'qwen'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => setProvider('qwen')}
                >
                  千问
                </button>
                <button
                  className={`flex-1 text-sm p-3 rounded border ${
                    provider === 'deepseek'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => setProvider('deepseek')}
                >
                  DeepSeek
                </button>
              </div>
            </div>

            {provider === 'qwen' && (
              <>
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-2">
                    千问 API Key（百炼平台）
                  </label>
                  <input
                    type="password"
                    className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                    placeholder="输入你的 API Key..."
                    value={inputQwenKey}
                    onChange={(e) => setInputQwenKey(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    从{' '}
                    <a
                      href="https://bailian.console.aliyun.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      百炼平台
                    </a>{' '}
                    获取 API Key
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-2">
                    模型
                  </label>
                  <select
                    className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                    value={selectedQwenModel}
                    onChange={(e) => setSelectedQwenModel(e.target.value)}
                  >
                    {QWEN_MODELS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {provider === 'deepseek' && (
              <>
                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-2">
                    DeepSeek API Key
                  </label>
                  <input
                    type="password"
                    className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                    placeholder="输入你的 API Key..."
                    value={inputDeepseekKey}
                    onChange={(e) => setInputDeepseekKey(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    从{' '}
                    <a
                      href="https://platform.deepseek.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      DeepSeek 开放平台
                    </a>{' '}
                    获取 API Key
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-gray-400 text-sm block mb-2">
                    模型
                  </label>
                  <select
                    className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                    value={selectedDeepseekModel}
                    onChange={(e) => setSelectedDeepseekModel(e.target.value)}
                  >
                    {DEEPSEEK_MODELS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="border-t border-gray-600 my-4 pt-4">
              <div className="text-white font-bold text-sm mb-3">图片生成配置（角色头像）</div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">
                  图片生成 API Key
                </label>
                <input
                  type="password"
                  className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                  placeholder="输入图片生成 API Key..."
                  value={inputImageKey}
                  onChange={(e) => setInputImageKey(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  默认使用 DashScope（百炼）图片生成 API
                </div>
              </div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">
                  图片模型
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                  placeholder="例如 wanx2.1-t2i-plus"
                  value={inputImageModel}
                  onChange={(e) => setInputImageModel(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">
                  图片 API 地址
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-700 text-white text-sm p-3 rounded border border-gray-500 focus:border-blue-400 outline-none"
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations"
                  value={inputImageUrl}
                  onChange={(e) => setInputImageUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
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
