import { logApiCall, logApiError } from '../store/logStore';

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
 * 与NPC对话（通过通义千问 API）
 */
export async function chatWithNPC(
  npcName: string,
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey: string,
  model: string,
  apiUrl: string
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const config = {
    model,
    temperature: 1.0,
    enable_thinking: false
  };

  // 记录 API 调用请求信息
  logApiCall(`API 调用: chatWithNPC (角色: ${npcName}, 模型: ${model})`, {
    systemPrompt,
    historyCount: history.length,
    userMessage,
    config,
  });

  const response = await fetch(apiUrl, {
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

  // 防御性检查：确保 API 返回了预期的数据结构
  const messageContent = data.choices?.[0]?.message?.content;
  if (typeof messageContent !== 'string') {
    logApiError('API 返回的数据结构异常', JSON.stringify({ data }, null, 2));
    throw new Error('API 返回的响应内容为空或格式异常');
  }

  const result: ChatResponse = {
    content: messageContent,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    }
  };

  // 记录 API 调用响应信息
  logApiCall(`API 返回成功 (角色: ${npcName}, 模型: ${model})`, {
    response: result.content,
    usage: result.usage,
    config,
  });

  return result;
}

/**
 * 多轮对话（保持上下文）
 */
export async function chatWithContext(
  messages: ChatMessage[],
  apiKey: string,
  model: string,
  apiUrl: string
): Promise<string> {
  const config = {
    model,
    temperature: 1.0,
    enable_thinking: false
  };

  // 记录 API 调用请求信息
  logApiCall(`API 调用: chatWithContext (模型: ${model})`, {
    messages,
    config,
  });

  const response = await fetch(apiUrl, {
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
  logApiCall(`API 返回成功 (chatWithContext, 模型: ${model})`, {
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
