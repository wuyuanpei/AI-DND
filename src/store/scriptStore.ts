import { create } from 'zustand';
import yaml from 'js-yaml';
import type { ParsedScript } from '../types';
import { logSystem, logError } from './logStore';

const ACTIVE_SCRIPT_ID_KEY = 'ai-dnd-active-script-id';
const SCRIPT_CONTENT_KEY_PREFIX = 'ai-dnd-script-';

interface ScriptState {
  activeScript: ParsedScript | null;
  activeScriptId: string | null;

  parseAndActivate: (markdownContent: string, scriptId: string) => void;
  deactivateScript: () => void;
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

  getNpcSystemPrompt: (npcId) => {
    const { activeScript } = get();
    if (!activeScript) return null;
    const npc = activeScript.npcs.find(n => n.id === npcId);
    return npc?.systemPrompt ?? null;
  },

  getDmSystemPrompt: () => {
    return get().activeScript?.dmPrompt ?? null;
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
  }));

  return {
    title: frontmatter.title as string,
    description: (frontmatter.description as string) || '',
    author: (frontmatter.author as string) || '',
    acts,
    dmPrompt: frontmatter.dmPrompt as string,
    npcs,
    body,
  };
}
