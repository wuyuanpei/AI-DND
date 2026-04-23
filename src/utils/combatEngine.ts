import { usePlayerStore } from '../store/playerStore';

export interface CombatAction {
  type: 'attack';
  target: string;      // 怪物 uniqueId 或 'player'
  method: string;      // 技能唯一ID
  description: string; // 行动描述
  monster?: string;    // 怪物回合时：发动攻击的怪物 uniqueId
}

export interface CombatMonsterState {
  uniqueId: string;
  prototypeId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  defense: number;
  strength: number;
  agility: number;
  skills: Array<{ name: string; rangeType: string; damage: string }>;
  x: number;
  y: number;
}

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function rollDamage(damageExpr: string): number {
  const match = damageExpr.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (match) {
    const count = parseInt(match[1], 10);
    const faces = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;
    let total = bonus;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
  }
  const num = parseInt(damageExpr, 10);
  if (!isNaN(num)) return num;
  return 0;
}

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  roll: number;
  modifier: number;
  total: number;
  targetDefense: number;
  targetName: string;
  targetUniqueId: string;
  targetCurrentHp: number;
  targetMaxHp: number;
}

export function resolvePlayerAttack(
  action: CombatAction,
  playerStrength: number,
  playerAgility: number,
  monsters: CombatMonsterState[],
  skillDamage?: string
): AttackResult {
  const target = monsters.find(m => m.uniqueId === action.target);
  if (!target) {
    throw new Error(`目标怪物未找到: ${action.target}`);
  }

  const modifier = getModifier(playerStrength);
  const roll = rollD20();
  const total = roll + modifier;
  const hit = total >= target.defense;

  let damage = 0;
  if (hit) {
    if (skillDamage) {
      damage = rollDamage(skillDamage);
    } else {
      damage = Math.floor(playerStrength / 2);
    }
  }

  const newHp = Math.max(0, target.currentHp - damage);
  target.currentHp = newHp;

  return {
    hit,
    damage,
    roll,
    modifier,
    total,
    targetDefense: target.defense,
    targetName: target.name,
    targetUniqueId: target.uniqueId,
    targetCurrentHp: newHp,
    targetMaxHp: target.maxHp,
  };
}

export function resolveMonsterAttack(
  action: CombatAction,
  monsters: CombatMonsterState[]
): AttackResult {
  const monster = monsters.find(m => m.uniqueId === action.monster);
  if (!monster) {
    throw new Error(`怪物未找到: ${action.monster}`);
  }

  const skill = monster.skills.find(s => s.name === action.method) || monster.skills[0];
  const modifier = getModifier(monster.strength);
  const roll = rollD20();
  const total = roll + modifier;

  const playerDefense = usePlayerStore.getState().defense;
  const hit = total >= playerDefense;

  let damage = 0;
  if (hit && skill) {
    damage = rollDamage(skill.damage);
  }

  return {
    hit,
    damage,
    roll,
    modifier,
    total,
    targetDefense: playerDefense,
    targetName: '玩家',
    targetUniqueId: 'player',
    targetCurrentHp: 0, // 由调用方更新玩家HP
    targetMaxHp: 0,
  };
}

export function buildCombatStatusContext(
  round: number,
  turn: 'player' | 'monster',
  monsters: CombatMonsterState[]
): string {
  const monsterStatus = monsters
    .map(m => `- ${m.name}（${m.uniqueId}）: HP ${m.currentHp}/${m.maxHp}, 防御 ${m.defense}, 坐标 (${m.x}, ${m.y})`)
    .join('\n');
  return `【战斗状态】第 ${round} 回合 — ${turn === 'player' ? '玩家回合' : '怪物回合'}\n\n怪物状态：\n${monsterStatus}`;
}

export function buildPlayerAttackResolutionMessage(
  result: AttackResult,
  action: CombatAction
): string {
  const hitText = result.hit ? '命中！' : '未命中！';
  const damageText = result.hit ? `\n伤害：${result.damage}点` : '';
  const hpText = result.hit
    ? `\n${result.targetName}（${result.targetUniqueId}）HP：${result.targetCurrentHp}/${result.targetMaxHp}`
    : '';

  return `（系统判定 — 玩家行动\n行动：${action.description}\n攻击检定：D20(${result.roll}) + ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total}\n目标防御：${result.targetDefense}\n结果：${hitText}${damageText}${hpText}）`;
}

export function buildMonsterAttackResolutionMessage(
  result: AttackResult,
  action: CombatAction
): string {
  const hitText = result.hit ? '命中！' : '未命中！';
  const damageText = result.hit ? `\n伤害：${result.damage}点` : '';

  return `（系统判定 — 怪物行动\n行动：${action.description}\n攻击检定：D20(${result.roll}) + ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total}\n目标防御：${result.targetDefense}\n结果：${hitText}${damageText}）`;
}

export function getDamageBySkillId(playerSkills: Array<{ id: string; name: string; damage?: string }>, skillId: string): string | undefined {
  const skill = playerSkills.find(s => s.id === skillId);
  return skill?.damage;
}
