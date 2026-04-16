import { logApiCall, logApiError } from '../store/logStore';

export interface ImageGenResponse {
  urls: string[];
}

/**
 * 生成角色头像图片
 * @param prompt 图片生成提示词
 * @param apiKey API Key
 * @param model 模型名称
 * @param apiUrl API 地址
 * @param n 生成数量
 */
export async function generateCharacterPortrait(
  prompt: string,
  apiKey: string,
  model: string,
  apiUrl: string,
  n: number = 3
): Promise<ImageGenResponse> {
  const config = {
    model,
    prompt,
    n,
    size: '768x1024',
  };

  logApiCall(`API 调用: generateCharacterPortrait (模型: ${model})`, {
    config: { apiUrl, prompt, n, size: config.size },
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'API请求失败' } }));
    const errorMsg = error.error?.message || 'API请求失败';
    logApiError(`图片生成失败: ${errorMsg}`, JSON.stringify({ status: response.status, prompt, config }, null, 2));
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const urls: string[] = [];

  if (Array.isArray(data.data)) {
    for (const item of data.data) {
      if (typeof item.url === 'string') {
        urls.push(item.url);
      } else if (typeof item.b64_json === 'string') {
        urls.push(`data:image/png;base64,${item.b64_json}`);
      }
    }
  }

  logApiCall(`图片生成成功 (模型: ${model})`, {
    config: { urlsCount: urls.length },
  });

  return { urls };
}

/**
 * 构建角色头像生成提示词
 */
export function buildPortraitPrompt(character: {
  name: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
}): string {
  const parts = [
    'A detailed fantasy character portrait in medieval style.',
    character.gender ? `${character.gender} character.` : '',
    character.appearance || '',
    character.personality ? `Expression shows ${character.personality.toLowerCase()} personality.` : '',
    character.backstory ? `Background hints at ${character.backstory.toLowerCase()}.` : '',
    'High quality digital art, soft lighting, 3:4 portrait composition, single character centered, clear face, no text.',
  ];
  return parts.filter(Boolean).join(' ');
}
