#!/usr/bin/env node
/**
 * 技能图标批量生成脚本
 *
 * 使用通义千问 qwen-image-2.0 批量生成技能图标。
 * 同时生成 4 个技能图标（2x2 雪碧图），然后分割为 512x512 的独立图标。
 *
 * 用法：
 *   DASHSCOPE_API_KEY=your_key node scripts/generate-skill-icons.mjs
 *
 * 可选环境变量：
 *   DASHSCOPE_API_KEY    - 必填，DashScope API Key
 *   DASHSCOPE_API_URL    - 可选，默认 DashScope API 地址
 *   ICON_SIZE            - 可选，单个图标尺寸，默认 512
 *   OUTPUT_DIR           - 可选，输出目录，默认 ../public/skills
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 配置 ============
const CONFIG = {
  apiKey: process.env.DASHSCOPE_API_KEY,
  apiUrl: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  model: 'qwen-image-2.0-pro',
  iconSize: parseInt(process.env.ICON_SIZE, 10) || 512,
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, '../public/skills'),
};

// 技能列表（4个，2x2网格）
const SKILLS = [
  {
    id: 'skill_unarmed',
    name: '赤手空拳',
    description: '一个拳头的图标，打过来。有动画的感觉，主体采用红色。',
  },
  {
    id: 'skill_mainWeapon',
    name: '近战-主武',
    description: '一个剑的图标，挥砍过来。有动画的感觉，主体采用红色。',
  },
  {
    id: 'skill_offWeapon',
    name: '近战-副武',
    description: '一个匕首的图标，刺过来。有动画的感觉，主体采用红色。',
  },
  {
    id: 'skill_ranged',
    name: '远程武器',
    description: '一支箭射过来。有动画的感觉，主体采用红色。',
  },
];

const GRID_COL = 2;
const GRID_ROW = 2;
const GRID_SIZE = CONFIG.iconSize * GRID_COL; // 1024

// ============ 工具函数 ============

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function iconExists(skillId) {
  try {
    const iconPath = path.join(CONFIG.outputDir, `${skillId}.png`);
    await fs.access(iconPath);
    return true;
  } catch {
    return false;
  }
}

function buildPrompt() {
  const iconSize = CONFIG.iconSize;
  const gridSize = GRID_SIZE;

  let prompt = `请生成一组共 ${SKILLS.length} 个独立的奇幻中世纪风格技能图标，并将它们组合成一张 ${GRID_COL}×${GRID_ROW} 网格的雪碧图（Sprite Sheet）。

画布尺寸：${gridSize}×${gridSize} 像素（对应网格，每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！）。
图标格式：每个图标必须是透明背景，边缘无锯齿，适合游戏引擎调用。
美术风格：奇幻中世纪风格，技能图标应带有魔法光泽或动作特效，有明显的技能感，适合作为游戏UI图标使用。

技能列表（请严格按照以下顺序排列）：\n`;

  for (let i = 0; i < SKILLS.length; i++) {
    const s = SKILLS[i];
    const row = Math.floor(i / GRID_COL) + 1;
    const col = (i % GRID_COL) + 1;
    prompt += `\n${i + 1}、第${row}排第${col}个：${s.name}，${s.description}`;
  }

  prompt += `\n\n重要要求：
1. 必须严格按上述顺序和网格位置排列，每个技能占据一个格子。
2. 每个技能图标必须是 ${iconSize}×${iconSize} 像素大小。
3. 整个画布必须是 ${gridSize}×${gridSize} 像素。
4. 每个技能图标之间要有明显的间距和分隔，不要重叠。
5. 背景必须是纯白色的。
6. 输出一张完整的雪碧图。`;

  return prompt;
}

async function generateSpriteSheet(prompt) {
  if (!CONFIG.apiKey) {
    throw new Error('未设置 DASHSCOPE_API_KEY 环境变量，请配置后再运行。');
  }

  const config = {
    model: CONFIG.model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    },
    parameters: {
      size: `${GRID_SIZE}*${GRID_SIZE}`,
      n: 1,
    },
  };

  console.log(`[API] 正在调用 ${CONFIG.model} 生成雪碧图 (${GRID_SIZE}x${GRID_SIZE})...`);
  console.log(`[API] 提示词长度: ${prompt.length} 字符`);

  const response = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `API请求失败 (HTTP ${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.message || errorJson.error?.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  let imageUrl = null;
  if (Array.isArray(data.output?.results)) {
    imageUrl = data.output.results[0]?.url;
  } else if (Array.isArray(data.output?.choices)) {
    const contents = data.output.choices[0]?.message?.content;
    if (Array.isArray(contents)) {
      imageUrl = contents[0]?.image || contents[0]?.url;
    }
  }

  if (!imageUrl) {
    console.error('[API] 响应数据:', JSON.stringify(data, null, 2));
    throw new Error('API 响应中未找到图片 URL');
  }

  console.log(`[API] 图片生成成功: ${imageUrl.slice(0, 80)}...`);
  return imageUrl;
}

async function downloadImage(url, outputPath) {
  console.log(`[下载] 正在下载图片...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  console.log(`[下载] 已保存到: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return buffer;
}

async function splitSpriteSheet(spritePath) {
  const iconSize = CONFIG.iconSize;

  console.log(`[分割] 正在分割雪碧图，网格: ${GRID_COL}x${GRID_ROW}，图标尺寸: ${iconSize}x${iconSize}`);

  const results = [];
  for (let i = 0; i < SKILLS.length; i++) {
    const skill = SKILLS[i];
    const row = Math.floor(i / GRID_COL);
    const col = i % GRID_COL;

    const left = col * iconSize;
    const top = row * iconSize;

    const outputPath = path.join(CONFIG.outputDir, `${skill.id}.png`);

    try {
      await sharp(spritePath)
        .extract({
          left,
          top,
          width: iconSize,
          height: iconSize,
        })
        .png()
        .toFile(outputPath);

      results.push({ skill, path: outputPath, success: true });
      console.log(`[分割] ✓ ${skill.name} -> ${path.relative(process.cwd(), outputPath)}`);
    } catch (err) {
      results.push({ skill, path: outputPath, success: false, error: err.message });
      console.error(`[分割] ✗ ${skill.name} 分割失败: ${err.message}`);
    }
  }

  return results;
}

// ============ 主流程 ============

async function main() {
  console.log('========================================');
  console.log('  技能图标批量生成脚本');
  console.log('========================================');
  console.log();

  if (!CONFIG.apiKey) {
    console.error('❌ 错误: 未设置 DASHSCOPE_API_KEY 环境变量');
    console.error('   请设置后再运行，例如:');
    console.error('   DASHSCOPE_API_KEY=your_key node scripts/generate-skill-icons.mjs');
    process.exit(1);
  }

  await ensureDir(CONFIG.outputDir);

  const skillsNeedGenerate = [];
  const skillsSkipped = [];
  for (const s of SKILLS) {
    if (await iconExists(s.id)) {
      skillsSkipped.push(s);
    } else {
      skillsNeedGenerate.push(s);
    }
  }

  if (skillsSkipped.length > 0) {
    console.log(`[跳过] ${skillsSkipped.length} 个技能图标已存在:`);
    for (const s of skillsSkipped) {
      console.log(`       - ${s.name}`);
    }
  }

  if (skillsNeedGenerate.length === 0) {
    console.log('\n✅ 所有技能图标已存在，无需生成。');
    return;
  }

  console.log(`\n[生成] 需要生成 ${skillsNeedGenerate.length} 个技能图标`);
  console.log(`[配置] 图标尺寸: ${CONFIG.iconSize}x${CONFIG.iconSize}`);
  console.log(`[配置] 雪碧图尺寸: ${GRID_SIZE}x${GRID_SIZE}`);
  console.log(`[配置] 输出目录: ${CONFIG.outputDir}`);
  console.log();

  try {
    const prompt = buildPrompt();
    const imageUrl = await generateSpriteSheet(prompt);

    const tempPath = path.join(CONFIG.outputDir, `__batch_sprite.png`);
    await downloadImage(imageUrl, tempPath);

    const results = await splitSpriteSheet(tempPath);

    try {
      await fs.unlink(tempPath);
      console.log(`[清理] 已删除临时文件`);
    } catch {
      // ignore
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    console.log(`\n[结果] 成功: ${successCount}, 失败: ${failCount}`);
  } catch (err) {
    console.error(`\n❌ 生成失败: ${err.message}`);
    process.exit(1);
  }

  console.log('========================================');
  console.log('  生成完成');
  console.log('========================================');

  const finalStatus = [];
  for (const s of SKILLS) {
    const exists = await iconExists(s.id);
    finalStatus.push({ name: s.name, exists });
  }

  const totalExists = finalStatus.filter((s) => s.exists).length;
  console.log(`\n总计: ${totalExists}/${SKILLS.length} 个技能图标已生成`);

  if (totalExists < SKILLS.length) {
    console.log('\n缺失的图标:');
    for (const s of finalStatus) {
      if (!s.exists) {
        console.log(`  - ${s.name}`);
      }
    }
    process.exit(1);
  }

  console.log('\n✅ 所有技能图标生成成功！');
}

main().catch((err) => {
  console.error('\n❌ 脚本执行失败:', err.message);
  process.exit(1);
});
