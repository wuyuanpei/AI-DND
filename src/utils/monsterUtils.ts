import type { Monster } from '../types';
import monstersData from '../data/monsters.json';

const allMonsters = monstersData.monsters as Monster[];

export function getAvailableMonsters(playerLevel: number): Monster[] {
  const maxExp = playerLevel * 50;
  return allMonsters.filter((m) => m.expReward <= maxExp);
}

export function buildMonsterPrompt(monsters: Monster[]): string {
  const lines = monsters.map((m) => {
    return `- ID: ${m.id}, 名称: ${m.name}, 描述: ${m.description}`;
  });

  return `【可用怪物列表】
以下是你能安排的遭遇怪物（只能使用列表中的怪物）：
${lines.join('\n')}

【怪物遭遇规则】
1. 你只能在上述列表中选择怪物安排遭遇。
2. 一次遭遇的怪物数量为 1-3 个。
3. 当玩家决定战斗或被怪物突袭时，你必须在 JSON 中返回 "attack" 字段，格式如下：
{
  "dialogue": "你的DM叙述",
  "attack": {
    "monsters": [
      {"id": "怪物ID", "x": 5, "y": 0}
    ]
  }
}
4. 玩家位于坐标 (0,0)，每个怪物有独立的 (x,y) 坐标，单位为米。
5. 怪物坐标应该根据触发剧情合理分布，例如围绕玩家周围数米到数十米的距离。
6. attack 字段中的怪物ID必须严格来自上方列表。`;
}

export function validateAttackPayload(
  attack: unknown,
  availableMonsterIds: Set<string>
): { valid: boolean; error?: string } {
  if (!attack || typeof attack !== 'object') {
    return { valid: false, error: 'attack 字段格式错误' };
  }
  const obj = attack as Record<string, unknown>;
  if (!Array.isArray(obj.monsters)) {
    return { valid: false, error: 'attack.monsters 必须是数组' };
  }
  if (obj.monsters.length === 0 || obj.monsters.length > 3) {
    return { valid: false, error: '遭遇怪物数量必须是 1-3 个' };
  }
  for (const m of obj.monsters) {
    if (!m || typeof m !== 'object') {
      return { valid: false, error: 'attack.monsters 中存在非法项' };
    }
    const mo = m as Record<string, unknown>;
    if (typeof mo.id !== 'string') {
      return { valid: false, error: '怪物缺少 id 字段' };
    }
    if (!availableMonsterIds.has(mo.id)) {
      return { valid: false, error: `怪物 ID "${mo.id}" 不在可用列表中` };
    }
    if (typeof mo.x !== 'number' || typeof mo.y !== 'number') {
      return { valid: false, error: `怪物 "${mo.id}" 缺少坐标` };
    }
  }
  return { valid: true };
}
