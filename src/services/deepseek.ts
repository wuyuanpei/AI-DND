import { logApiCall, logApiError } from '../store/logStore';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  content: string;
  usage: TokenUsage;
}

/**
 * 与NPC对话（通过DeepSeek API）
 */
export async function chatWithNPC(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const config = {
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 100
  };

  // 记录 API 调用请求信息
  logApiCall(`API 调用: chatWithNPC (NPC: ${extractNpcName(systemPrompt)})`, {
    systemPrompt,
    historyCount: history.length,
    userMessage,
    config,
  });

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      ...config,
      messages,
    })
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.error?.message || 'API请求失败';
    logApiError(`API 调用失败: ${errorMsg}`, JSON.stringify({ status: response.status, systemPrompt, userMessage, config }, null, 2));
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const result: ChatResponse = {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };

  // 记录 API 调用响应信息
  logApiCall(`API 返回成功 (NPC: ${extractNpcName(systemPrompt)})`, {
    response: result.content,
    usage: result.usage,
    config,
  });

  return result;
}

// 从系统提示中提取 NPC 名称（用于日志显示）
function extractNpcName(systemPrompt: string): string {
  const match = systemPrompt.match(/你是 DND 游戏中的(.+?)[。\.]/);
  return match ? match[1] : '未知';
}

/**
 * 多轮对话（保持上下文）
 */
export async function chatWithContext(
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const config = {
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 100
  };

  // 记录 API 调用请求信息
  logApiCall('API 调用: chatWithContext', {
    messages,
    config,
  });

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      ...config,
      messages,
    })
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMsg = error.error?.message || 'API请求失败';
    logApiError(`API 调用失败 (chatWithContext): ${errorMsg}`, JSON.stringify({ status: response.status, config }, null, 2));
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // 记录 API 调用响应信息
  logApiCall('API 返回成功 (chatWithContext)', {
    response: content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    config,
  });

  return content;
}