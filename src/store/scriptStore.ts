import { create } from 'zustand';
import yaml from 'js-yaml';
import type { ParsedScript } from '../types';
import { logSystem, logError } from './logStore';
import { parseLLMJson } from '../utils/parseLLMJson';
import {
  DM_NPC_LIST_HEADER,
  DM_SCRIPT_STRUCTURE_HEADER,
  DM_CURRENT_ACT_HEADER_PREFIX,
  DM_CURRENT_ACT_HEADER_SUFFIX,
  DM_CURRENT_ACT_GUIDE,
  DM_ENDINGS_HEADER,
  DM_JSON_FORMAT_HEADER,
  DM_JSON_FORMAT_PROMPT,
} from '../config/dmConfig';

const ACTIVE_SCRIPT_ID_KEY = 'ai-dnd-active-script-id';
const SCRIPT_CONTENT_KEY_PREFIX = 'ai-dnd-script-';

interface ScriptState {
  activeScript: ParsedScript | null;
  activeScriptId: string | null;

  parseAndActivate: (markdownContent: string, scriptId: string) => void;
  deactivateScript: () => void;
  updateScriptProgressByLLM: (content: string) => void;
  getNpcSystemPrompt: (npcId: string) => string | null;
  getDmSystemPrompt: () => string | null;
  hasScriptNpc: (npcId: string) => boolean;
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  activeScript: null,
  activeScriptId: null,

  parseAndActivate: (markdownContent, scriptId) => {
    try {
      const parsed = parseScriptMarkdown(markdownContent);

      localStorage.setItem(SCRIPT_CONTENT_KEY_PREFIX + scriptId, markdownContent);
      localStorage.setItem(ACTIVE_SCRIPT_ID_KEY, scriptId);

      set({ activeScript: parsed, activeScriptId: scriptId });

      logSystem(`剧本已激活: ${parsed.title}`, JSON.stringify({
        title: parsed.title,
        author: parsed.author,
        acts: parsed.acts.length,
        npcs: parsed.npcs.length,
      }));
    } catch (e) {
      logError('剧本解析失败', e instanceof Error ? e.message : String(e));
      throw e;
    }
  },

  deactivateScript: () => {
    const state = get();
    if (state.activeScript) {
      logSystem(`剧本已停用: ${state.activeScript.title}`);
    }
    localStorage.removeItem(ACTIVE_SCRIPT_ID_KEY);
    set({ activeScript: null, activeScriptId: null });
  },

  updateScriptProgressByLLM: (content) => {
    const { activeScript } = get();
    if (!activeScript) return;

    const result = parseLLMJson(content);
    if (result.error) {
      logError('LLM 剧本推进指令解析失败', `${result.error}; 原始内容: ${content.slice(0, 500)}`);
    }

    let updated = activeScript;

    const switchToAct = (result.parsed?.switch_to_act ?? result.switch_to_act) as string | undefined;
    if (typeof switchToAct === 'string') {
      const actId = switchToAct.trim();
      const act = activeScript.acts.find(a => a.id === actId);
      if (act && activeScript.currentActId !== actId) {
        updated = { ...updated, currentActId: actId };
        logSystem(`当前章节推进: ${act.title}`);
      }
    }

    const switchToEnding = (result.parsed?.switch_to_ending ?? result.switch_to_ending) as string | undefined;
    if (typeof switchToEnding === 'string') {
      const endingId = switchToEnding.trim();
      const ending = activeScript.endings.find(e => e.id === endingId);
      if (ending && activeScript.currentEndingId !== endingId) {
        updated = { ...updated, currentEndingId: endingId };
        logSystem(`当前结局切换: ${ending.title}`);
      }
    }

    if (updated !== activeScript) {
      set({ activeScript: updated });
    }
  },

  getNpcSystemPrompt: (npcId) => {
    const { activeScript } = get();
    if (!activeScript) return null;
    const npc = activeScript.npcs.find(n => n.id === npcId);
    return npc?.systemPrompt ?? null;
  },

  getDmSystemPrompt: () => {
    const { activeScript } = get();
    if (!activeScript) {
      logSystem('getDmSystemPrompt: activeScript 为 null');
      return null;
    }

    let prompt = activeScript.dmPrompt;

    if (activeScript.npcs.length > 0) {
      prompt += `\n\n${DM_NPC_LIST_HEADER}\n`;
      activeScript.npcs.forEach((npc) => {
        prompt += `- ${npc.name}（id: ${npc.id}）${npc.summary ? `：${npc.summary}` : ''}\n`;
      });
    }

    if (activeScript.acts.length > 0) {
      prompt += `\n${DM_SCRIPT_STRUCTURE_HEADER}\n`;
      activeScript.acts.forEach((act, index) => {
        prompt += `${index + 1}. id=${act.id} | ${act.title}\n   概要：${act.synopsis}\n`;
      });

      const currentAct = activeScript.acts.find(a => a.id === activeScript.currentActId);
      if (currentAct?.content) {
        prompt += `\n${DM_CURRENT_ACT_HEADER_PREFIX}${currentAct.title}${DM_CURRENT_ACT_HEADER_SUFFIX}\n${DM_CURRENT_ACT_GUIDE(currentAct.title)}\n${currentAct.content}\n`;
      } else {
        logError('getDmSystemPrompt: 未找到当前章节内容', `currentActId=${activeScript.currentActId}, acts=${JSON.stringify(activeScript.acts.map(a => ({id: a.id, hasContent: !!a.content})))}`);
      }
    } else {
      logSystem('getDmSystemPrompt: 剧本无幕数据');
    }

    if (activeScript.endings.length > 0) {
      prompt += `\n${DM_ENDINGS_HEADER}\n`;
      activeScript.endings.forEach((ending) => {
        prompt += `- id=${ending.id} | ${ending.title}\n  触发条件：${ending.condition || '无'}\n  简介：${ending.synopsis || '无'}\n`;
      });
    }

    prompt += `\n${DM_JSON_FORMAT_HEADER}\n${DM_JSON_FORMAT_PROMPT}\n`;

    return prompt;
  },

  hasScriptNpc: (npcId) => {
    const { activeScript } = get();
    if (!activeScript) return false;
    return activeScript.npcs.some(n => n.id === npcId);
  },
}));

// 模块加载时自动恢复激活的剧本
(function restoreActiveScript() {
  try {
    const scriptId = localStorage.getItem(ACTIVE_SCRIPT_ID_KEY);
    if (scriptId) {
      const markdownContent = localStorage.getItem(SCRIPT_CONTENT_KEY_PREFIX + scriptId);
      if (markdownContent) {
        const parsed = parseScriptMarkdown(markdownContent);
        useScriptStore.setState({ activeScript: parsed, activeScriptId: scriptId });
      }
    }
  } catch {
    // 忽略恢复错误
  }
})();

function parseScriptMarkdown(markdown: string): ParsedScript {
  const match = markdown.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!match) {
    throw new Error('无效的剧本格式：缺少 YAML frontmatter（--- 分隔符）');
  }

  const frontmatterStr = match[1];
  const body = match[2].trim();

  const frontmatter = yaml.load(frontmatterStr) as Record<string, unknown>;

  if (!frontmatter.title) throw new Error('剧本缺少 title 字段');
  if (!frontmatter.dmPrompt) throw new Error('剧本缺少 dmPrompt 字段');

  const npcs = ((frontmatter.npcs as Record<string, unknown>[]) || []).map((n, i) => ({
    id: (n.id as string) || `npc_${i}`,
    name: (n.name as string) || 'Unknown',
    summary: (n.summary as string) || '',
    personality: (n.personality as string) || '',
    background: (n.background as string) || '',
    dialogueStyle: (n.dialogueStyle as string) || '',
    systemPrompt: (n.systemPrompt as string) || '',
    stats: {
      strength: (n.stats as Record<string, number>)?.strength ?? 10,
      agility: (n.stats as Record<string, number>)?.agility ?? 10,
      intelligence: (n.stats as Record<string, number>)?.intelligence ?? 10,
      charisma: (n.stats as Record<string, number>)?.charisma ?? 10,
    },
  }));

  const acts = ((frontmatter.acts as Record<string, unknown>[]) || []).map((a, i) => ({
    id: (a.id as string) || `act_${i}`,
    title: (a.title as string) || `第${i + 1}幕`,
    synopsis: (a.synopsis as string) || '',
    content: (a.content as string) || '',
  }));

  const endings = ((frontmatter.endings as Record<string, unknown>[]) || []).map((e, i) => ({
    id: (e.id as string) || `ending_${i}`,
    title: (e.title as string) || `结局${i + 1}`,
    condition: (e.condition as string) || '',
    synopsis: (e.synopsis as string) || '',
    content: (e.content as string) || '',
  }));

  const currentActId = acts.length > 0 ? acts[0].id : null;

  return {
    title: frontmatter.title as string,
    description: (frontmatter.description as string) || '',
    author: (frontmatter.author as string) || '',
    acts,
    endings,
    dmPrompt: frontmatter.dmPrompt as string,
    npcs,
    body,
    currentActId,
    currentEndingId: null,
  };
}
