import { logApiCall, logApiError } from '../store/logStore';

export interface ImageGenResponse {
  urls: string[];
}

/**
 * 生成角色头像图片（使用 DashScope 原生多模态生成接口）
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
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    },
    parameters: {
      size: '768*1024',
      n,
    },
  };

  logApiCall(`API 调用: generateCharacterPortrait (模型: ${model})`, {
    config: { apiUrl, prompt, n, size: config.parameters.size },
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

  if (Array.isArray(data.output?.results)) {
    for (const item of data.output.results) {
      if (typeof item.url === 'string') {
        urls.push(item.url);
      } else if (typeof item.b64_json === 'string') {
        urls.push(`data:image/png;base64,${item.b64_json}`);
      }
    }
  } else if (Array.isArray(data.output?.choices)) {
    for (const choice of data.output.choices) {
      const contents = choice.message?.content;
      if (Array.isArray(contents)) {
        for (const c of contents) {
          if (typeof c.image === 'string') {
            urls.push(c.image);
          } else if (typeof c.url === 'string') {
            urls.push(c.url);
          }
        }
      }
    }
  }

  logApiCall(`图片生成成功 (模型: ${model})`, {
    config: { urlsCount: urls.length },
  });

  return { urls };
}
