export function buildPortraitPrompt(character: {
  name: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
}): string {
  const parts = [
    '中世纪奇幻风格角色半身像，高质量数字绘画，柔和光线，竖版3:4构图，单人居中，面部清晰，无文字水印。',
    character.gender ? `性别：${character.gender}。` : '',
    character.appearance ? `外貌：${character.appearance}。` : '',
    character.personality ? `神态表情体现出${character.personality}的性格。` : '',
    character.backstory ? `背景氛围暗示其经历：${character.backstory}。` : '',
  ];
  return parts.filter(Boolean).join('');
}
