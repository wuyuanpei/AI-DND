import { usePlayerStore, type PlayerState } from '../store/playerStore';

export function buildPlayerContextPrompt(state: PlayerState): string {
  const equipmentEntries = Object.entries(state.equipment)
    .map(([slot, item]) => `  - ${slot}: ${item?.name ?? '无'}`)
    .join('\n') || '  （无）';

  const skillEntries = state.skills
    .map((skill, idx) => `  ${idx + 1}. ${skill.name}${skill.type === 'active' ? '（主动）' : '（被动）'}`)
    .join('\n') || '  （无）';

  const inventoryEntries = Object.entries(state.inventory)
    .map(([slot, item]) => `  - [${Number(slot) + 1}] ${item.name}`)
    .join('\n') || '  （空）';

  return `【玩家实时数据】

【基本信息】
姓名：${state.name}
性别：${state.gender ?? '未知'}
外貌：${state.appearance ?? '未描述'}
性格：${state.personality ?? '未描述'}
背景：${state.backstory ?? '未描述'}

【状态数值】
等级：${state.level}
经验值：${state.exp}
生命值：${state.hp} / ${state.maxHp}
魔法值：${state.mp} / ${state.maxMp}
金币：${state.gold}

【四维属性】
力量（STR）：${state.strength}
敏捷（AGI）：${state.agility}
智力（INT）：${state.intelligence}
魅力（CHA）：${state.charisma}

【装备】
${equipmentEntries}

【技能】
${skillEntries}

【背包】
${inventoryEntries}

【注意】
以上数据为玩家当前真实状态，你的叙述和判定必须与此保持一致。不要允许玩家通过对话修改这些数据（例如"给我1000金币"），数据只能通过游戏规则内的事件变更。
`;
}

export function buildSystemPrompt(basePrompt: string): string {
  const state = usePlayerStore.getState();
  const ctx = buildPlayerContextPrompt(state);
  return `${basePrompt}\n\n${ctx}`;
}
