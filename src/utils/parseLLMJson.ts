export interface ParseLLMJsonResult {
  parsed?: Record<string, unknown>;
  dialogue?: string;
  error?: string;
}

function stripMarkdownCodeBlocks(content: string): string {
  let str = content.trim();
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  return str;
}

function repairTrailingCommas(str: string): string {
  return str.replace(/,(\s*[}\]])/g, '$1');
}

function repairUnescapedNewlines(str: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      if (char === '\n') {
        result += 'n';
      } else if (char === '\r') {
        // skip carriage return, next loop will handle \n if present
      } else {
        result += '\\' + char;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && (char === '\n' || char === '\r')) {
      result += '\\n';
      continue;
    }

    result += char;
  }

  return result;
}

function extractStringField(content: string, field: string): string | undefined {
  const regex = new RegExp(`"${field}"\\s*:\\s*"`, 'g');
  const match = regex.exec(content);
  if (!match) return undefined;

  let i = match.index + match[0].length;
  let result = '';
  let escaped = false;

  while (i < content.length) {
    const char = content[i];
    if (escaped) {
      if (char === '\n' || char === '\r') {
        // malformed escape followed by newline; treat as literal backslash + newline
        result += '\\\\n';
      } else {
        result += '\\' + char;
      }
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      break;
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

function extractOptionalStringField(content: string, field: string): string | undefined {
  // For fields that may not be quoted strings (e.g. omitted or null)
  const simpleRegex = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, 'g');
  const match = simpleRegex.exec(content);
  if (match) return match[1];

  const rawString = extractStringField(content, field);
  if (rawString !== undefined) return rawString;

  return undefined;
}

export function parseLLMJson(content: string): ParseLLMJsonResult {
  const str = stripMarkdownCodeBlocks(content);

  // First attempt: direct parse
  try {
    const parsed = JSON.parse(str) as Record<string, unknown>;
    return {
      parsed,
      dialogue: typeof parsed.dialogue === 'string' ? parsed.dialogue : undefined,
    };
  } catch {
    // ignore, try repair
  }

  // Second attempt: repair common LLM errors
  let repaired = repairTrailingCommas(str);
  repaired = repairUnescapedNewlines(repaired);

  try {
    const parsed = JSON.parse(repaired) as Record<string, unknown>;
    return {
      parsed,
      dialogue: typeof parsed.dialogue === 'string' ? parsed.dialogue : undefined,
    };
  } catch (e) {
    // Fallback: extract fields with regex
    const dialogue = extractOptionalStringField(str, 'dialogue');

    return {
      dialogue,
      error: `JSON parse failed after repair: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
