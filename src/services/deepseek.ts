const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 与NPC对话（通过DeepSeek API）
 */
export async function chatWithNPC(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 100
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API请求失败');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 多轮对话（保持上下文）
 */
export async function chatWithContext(
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 100
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API请求失败');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}