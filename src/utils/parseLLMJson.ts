export interface ParseLLMJsonResult {
  parsed?: Record<string, unknown>;
  dialogue?: string;
  options?: string[];
  buy?: string[];
  character?: unknown;
  startAdventure?: boolean;
  rewardGold?: number;
  rewardExp?: number;
  deductGold?: number;
  error?: string;
  attack?: {
    monsters: Array<{ id: string; x: number; y: number }>;
    environment?: string;
    battleBackground?: string;
  };
  combatResult?: {
    outcome: 'victory' | 'defeat' | 'escape';
    battleSummary?: string;
  };
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

function repairUnescapedQuotes(str: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      result += '\\' + char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"' && !escaped) {
      if (!inString) {
        inString = true;
        result += char;
        continue;
      }

      // We're inside a string and found a quote. Check if it looks like the real closing quote.
      // Heuristic: skip whitespace after the quote, then check if the next char is , } ] or end of string.
      // If yes, it's likely the closing quote. Otherwise, it's an unescaped quote inside the string.
      let j = i + 1;
      while (j < str.length && /[\s]/.test(str[j])) j++;
      const nextChar = str[j];
      const isClosing = nextChar === ',' || nextChar === '}' || nextChar === ']' || j >= str.length;

      if (isClosing) {
        inString = false;
        result += char;
      } else {
        result += '\\"';
      }
      continue;
    }

    result += char;
  }

  return result;
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

function extractStringArrayField(content: string, field: string): string[] | undefined {
  const regex = new RegExp(`"${field}"\\s*:\\s*\\[`, 'g');
  const match = regex.exec(content);
  if (!match) return undefined;

  let i = match.index + match[0].length;
  const items: string[] = [];
  let current = '';
  let inString = false;
  let escaped = false;
  let depth = 0;

  while (i < content.length) {
    const char = content[i];

    if (char === ']' && !inString && depth === 0) {
      if (current.trim()) {
        const trimmed = current.trim();
        if (trimmed) items.push(trimmed);
      }
      break;
    }

    if (char === '{' && !inString) {
      depth++;
      current += char;
      i++;
      continue;
    }

    if (char === '}' && !inString) {
      depth--;
      current += char;
      i++;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      i++;
      continue;
    }

    if (escaped) {
      if (char === '"') {
        current += '"';
      } else if (char === 'n') {
        current += '\\n';
      } else {
        current += '\\' + char;
      }
      escaped = false;
      i++;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      if (!inString) {
        // end of string
        items.push(current);
        current = '';
        // skip following comma or whitespace
        let j = i + 1;
        while (j < content.length && /[\s,]/.test(content[j])) j++;
        i = j;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      current += char;
    }

    i++;
  }

  return items.length > 0 ? items : undefined;
}

function parseOptions(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const result = value.filter((v): v is string => typeof v === 'string');
    return result.length > 0 ? result : undefined;
  }
  return undefined;
}

function parseAttack(value: unknown): ParseLLMJsonResult['attack'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.monsters)) return undefined;
  const monsters = obj.monsters.filter((m): m is { id: string; x: number; y: number } => {
    if (!m || typeof m !== 'object') return false;
    const mo = m as Record<string, unknown>;
    return typeof mo.id === 'string' && typeof mo.x === 'number' && typeof mo.y === 'number';
  });
  if (monsters.length === 0) return undefined;
  return {
    monsters,
    environment: typeof obj.environment === 'string' ? obj.environment : undefined,
    battleBackground: typeof obj.battleBackground === 'string' ? obj.battleBackground : undefined,
  };
}

function parseCombatResult(value: unknown): ParseLLMJsonResult['combatResult'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  const outcome = obj.outcome;
  if (outcome !== 'victory' && outcome !== 'defeat' && outcome !== 'escape') return undefined;
  return {
    outcome,
    battleSummary: typeof obj.battleSummary === 'string' ? obj.battleSummary : undefined,
  };
}

function extractParsedFields(parsed: Record<string, unknown>): Omit<ParseLLMJsonResult, 'parsed' | 'error'> {
  const dialogueValue = typeof parsed.dialogue === 'string' ? parsed.dialogue : typeof parsed.dialog === 'string' ? parsed.dialog : undefined;
  return {
    dialogue: dialogueValue,
    options: parseOptions(parsed.options),
    buy: parseOptions(parsed.buy),
    character: parsed.character,
    startAdventure: parsed.startAdventure === true,
    rewardGold: typeof parsed.rewardGold === 'number' ? parsed.rewardGold : undefined,
    rewardExp: typeof parsed.rewardExp === 'number' ? parsed.rewardExp : undefined,
    deductGold: typeof parsed.deductGold === 'number' ? parsed.deductGold : undefined,
    attack: parseAttack(parsed.attack),
    combatResult: parseCombatResult(parsed.combatResult),
  };
}

export function parseLLMJson(content: string): ParseLLMJsonResult {
  const str = stripMarkdownCodeBlocks(content);

  // First attempt: direct parse
  try {
    const parsed = JSON.parse(str) as Record<string, unknown>;
    return {
      parsed,
      ...extractParsedFields(parsed),
    };
  } catch {
    // ignore, try repair
  }

  // Second attempt: repair common LLM errors
  let repaired = repairTrailingCommas(str);
  repaired = repairUnescapedNewlines(repaired);
  repaired = repairUnescapedQuotes(repaired);

  try {
    const parsed = JSON.parse(repaired) as Record<string, unknown>;
    return {
      parsed,
      ...extractParsedFields(parsed),
    };
  } catch (e) {
    // Fallback: extract fields with regex, or use raw string as dialogue
    const dialogue = extractOptionalStringField(str, 'dialogue') ?? extractOptionalStringField(str, 'dialog') ?? str.trim();
    const options = extractStringArrayField(str, 'options');
    const buy = extractStringArrayField(str, 'buy');

    return {
      dialogue,
      options,
      buy,
    };
  }
}
