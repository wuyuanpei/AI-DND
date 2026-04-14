import React, { useState } from 'react';
import { useDialogueStore } from '../../store/dialogueStore';
import { useSettingsStore } from '../../store/settingsStore';
import { chatWithNPC } from '../../services/deepseek';

const Dialogue: React.FC = () => {
  const {
    isOpen,
    mode,
    npcName,
    currentNodeId,
    nodes,
    messages,
    isLoading,
    selectChoice,
    addMessage,
    closeDialogue,
    setLoading,
  } = useDialogueStore();
  const { deepseekApiKey } = useSettingsStore();
  const [userInput, setUserInput] = useState('');

  // 获取当前对话节点
  const currentNode = nodes.find((n) => n.id === currentNodeId);

  // 处理LLM对话输入
  const handleLLMSubmit = async () => {
    if (!userInput.trim() || !deepseekApiKey) return;

    setLoading(true);
    addMessage({ role: 'user', content: userInput });
    setUserInput('');

    try {
      const response = await chatWithNPC(
        `你是DND游戏中的${npcName}。请用中世纪奇幻风格与玩家对话，保持简短（不超过50字）。`,
        userInput,
        deepseekApiKey
      );
      addMessage({ role: 'assistant', content: response });
    } catch (error) {
      addMessage({ role: 'assistant', content: '（对话出错...）' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        按住 WASD 移动，靠近 NPC 点击对话
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* NPC名称 */}
      <div className="text-yellow-400 font-bold text-sm mb-2 border-b border-gray-600 pb-1">
        {npcName}
      </div>

      {/* 对话内容 */}
      <div className="flex-1 overflow-y-auto mb-2 text-white text-sm">
        {/* 脚本模式：显示当前节点文本 */}
        {mode === 'scripted' && currentNode && (
          <div className="bg-gray-600 rounded p-2 mb-2">{currentNode.text}</div>
        )}

        {/* LLM模式：显示对话历史 */}
        {mode === 'llm' && (
          <div className="space-y-2">
            {messages
              .filter((m) => m.role !== 'system')
              .map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded ${
                    msg.role === 'user'
                      ? 'bg-blue-600 ml-4'
                      : 'bg-gray-600 mr-4'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            {isLoading && (
              <div className="text-gray-400 text-center">思考中...</div>
            )}
          </div>
        )}
      </div>

      {/* 选项/输入区域 */}
      <div className="flex-shrink-0">
        {/* 脚本模式：显示选项 */}
        {mode === 'scripted' && currentNode?.choices && (
          <div className="space-y-1">
            {currentNode.choices.map((choice, idx) => (
              <button
                key={idx}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white text-xs p-2 rounded text-left"
                onClick={() => selectChoice(idx)}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}

        {/* LLM模式：输入框 */}
        {mode === 'llm' && (
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-600 text-white text-sm p-2 rounded border border-gray-500 focus:border-blue-400 outline-none"
              placeholder="输入消息..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLLMSubmit()}
              disabled={isLoading}
            />
            <button
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 rounded disabled:opacity-50"
              onClick={handleLLMSubmit}
              disabled={isLoading || !userInput.trim()}
            >
              发送
            </button>
          </div>
        )}
      </div>

      {/* 关闭按钮 */}
      <button
        className="mt-2 text-gray-400 hover:text-white text-xs"
        onClick={closeDialogue}
      >
        [关闭对话]
      </button>
    </div>
  );
};

export default Dialogue;