import { usePlayerStore } from '../store/playerStore';
import { savePlayerJson } from './playerDB';

const PLAYER_STATS_KEY = 'ai-dnd-player-stats';

export function savePlayerStatsToStorage(): void {
  const s = usePlayerStore.getState();
  localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify({
    isCreated: s.isCreated,
    level: s.level,
    hp: s.hp,
    maxHp: s.maxHp,
    mp: s.mp,
    maxMp: s.maxMp,
    exp: s.exp,
    gold: s.gold,
    equipment: s.equipment,
    inventory: s.inventory,
    skills: s.skills,
    strength: s.strength,
    agility: s.agility,
    intelligence: s.intelligence,
    charisma: s.charisma,
  }));
}

export function loadPlayerStatsFromStorage(): boolean {
  const raw = localStorage.getItem(PLAYER_STATS_KEY);
  if (!raw) return false;
  try {
    const stats = JSON.parse(raw);
    usePlayerStore.setState({
      isCreated: stats.isCreated,
      level: stats.level,
      hp: stats.hp,
      maxHp: stats.maxHp,
      mp: stats.mp,
      maxMp: stats.maxMp,
      exp: stats.exp,
      gold: stats.gold,
      equipment: stats.equipment,
      inventory: stats.inventory,
      skills: stats.skills,
      strength: stats.strength,
      agility: stats.agility,
      intelligence: stats.intelligence,
      charisma: stats.charisma,
      // 兼容旧版：如果 localStorage 中仍有文本字段，先迁移到 IndexedDB
      ...(stats.name !== undefined ? { name: stats.name } : {}),
      ...(stats.gender !== undefined ? { gender: stats.gender } : {}),
      ...(stats.appearance !== undefined ? { appearance: stats.appearance } : {}),
      ...(stats.personality !== undefined ? { personality: stats.personality } : {}),
      ...(stats.backstory !== undefined ? { backstory: stats.backstory } : {}),
    });

    // 一次性迁移：旧版文本字段存在时，写入 IndexedDB 并从 localStorage 中清理
    if (stats.name !== undefined) {
      void savePlayerJson({
        name: stats.name,
        gender: stats.gender,
        appearance: stats.appearance,
        personality: stats.personality,
        backstory: stats.backstory,
      });
      savePlayerStatsToStorage();
    }

    return true;
  } catch {
    return false;
  }
}

export function clearPlayerStats(): void {
  localStorage.removeItem(PLAYER_STATS_KEY);
}
