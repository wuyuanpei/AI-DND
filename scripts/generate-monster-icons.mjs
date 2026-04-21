#!/usr/bin/env node
/**
 * 怪物图标批量生成脚本
 *
 * 使用通义千问 qwen-image-2.0 批量生成怪物图标。
 * 每批生成 9 个怪物图标（3x3 雪碧图），然后分割为 512x512 的独立图标。
 *
 * 用法：
 *   DASHSCOPE_API_KEY=your_key node scripts/generate-monster-icons.mjs
 *
 * 可选环境变量：
 *   DASHSCOPE_API_KEY    - 必填，DashScope API Key
 *   DASHSCOPE_API_URL    - 可选，默认 DashScope API 地址
 *   ICON_SIZE            - 可选，单个图标尺寸，默认 512
 *   GRID_SIZE            - 可选，雪碧图尺寸（ICON_SIZE * 3），默认 1536
 *   OUTPUT_DIR           - 可选，输出目录，默认 ../public/monsters
 *   MONSTERS_JSON        - 可选，怪物数据文件路径，默认 ../src/data/monsters.json
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
  model: 'qwen-image-2.0',
  iconSize: parseInt(process.env.ICON_SIZE, 10) || 512,
  gridSize: parseInt(process.env.GRID_SIZE, 10) || 1536,
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, '../public/monsters'),
  monstersJson: process.env.MONSTERS_JSON || path.resolve(__dirname, '../src/data/monsters.json'),
  batchSize: 9,
};

// ============ 工具函数 ============

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function loadMonsters() {
  const raw = await fs.readFile(CONFIG.monstersJson, 'utf-8');
  const data = JSON.parse(raw);
  return data.monsters || [];
}

async function iconExists(monsterId) {
  try {
    const iconPath = path.join(CONFIG.outputDir, `${monsterId}.png`);
    await fs.access(iconPath);
    return true;
  } catch {
    return false;
  }
}

function buildBatchPrompt(monsters) {
  const iconSize = CONFIG.iconSize;
  const gridSize = CONFIG.gridSize;
  const count = monsters.length;
  const gridDim = Math.ceil(Math.sqrt(count));

  let prompt = `请生成一组共 ${count} 个独立的奇幻中世纪风格怪物角色图标，并将它们组合成一张 ${gridDim}×${gridDim} 网格的雪碧图（Sprite Sheet）。

画布尺寸：${gridSize}×${gridSize} 像素（对应网格，每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！）。
图标格式：每个图标必须是纯白色背景，边缘无锯齿，适合游戏引擎调用。
美术风格：奇幻中世纪风格，参考《龙与地下城》的写实质感，每个怪物图标单独呈现，有明显的角色感，适合作为游戏UI图标使用。背景必须为纯白色。

怪物列表（请严格按照以下顺序排列）：\n`;

  const gridCol = gridDim;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    const row = Math.floor(i / gridCol) + 1;
    const col = (i % gridCol) + 1;
    prompt += `\n${i + 1}、第${row}排第${col}个：${m.name}，${m.description}`;
    prompt += `。`;
  }

  prompt += `\n\n重要要求：
1. 必须严格按上述顺序和网格位置排列，每个怪物占据一个格子。
2. 每个怪物图标必须是 ${iconSize}×${iconSize} 像素大小。
3. 整个画布必须是 ${gridSize}×${gridSize} 像素。
4. 每个怪物图标之间要有明显的间距和分隔，不要重叠。
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
      size: `${CONFIG.gridSize}*${CONFIG.gridSize}`,
      n: 1,
    },
  };

  console.log(`[API] 正在调用 ${CONFIG.model} 生成雪碧图 (${CONFIG.gridSize}x${CONFIG.gridSize})...`);
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

async function splitSpriteSheet(spritePath, monsters) {
  const iconSize = CONFIG.iconSize;
  const gridCol = Math.ceil(Math.sqrt(monsters.length));

  console.log(`[分割] 正在分割雪碧图，网格: ${gridCol}x${gridCol}，图标尺寸: ${iconSize}x${iconSize}`);

  const results = [];
  for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    const row = Math.floor(i / gridCol);
    const col = i % gridCol;

    const left = col * iconSize;
    const top = row * iconSize;

    const outputPath = path.join(CONFIG.outputDir, `${monster.id}.png`);

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

      results.push({ monster, path: outputPath, success: true });
      console.log(`[分割] ✓ ${monster.name} -> ${path.relative(process.cwd(), outputPath)}`);
    } catch (err) {
      results.push({ monster, path: outputPath, success: false, error: err.message });
      console.error(`[分割] ✗ ${monster.name} 分割失败: ${err.message}`);
    }
  }

  return results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 主流程 ============

async function main() {
  console.log('========================================');
  console.log('  怪物图标批量生成脚本');
  console.log('========================================');
  console.log();

  if (!CONFIG.apiKey) {
    console.error('❌ 错误: 未设置 DASHSCOPE_API_KEY 环境变量');
    console.error('   请设置后再运行，例如:');
    console.error('   DASHSCOPE_API_KEY=your_key node scripts/generate-monster-icons.mjs');
    process.exit(1);
  }

  console.log('[加载] 读取怪物数据...');
  const allMonsters = await loadMonsters();
  console.log(`[加载] 共 ${allMonsters.length} 个怪物`);

  await ensureDir(CONFIG.outputDir);

  const monstersNeedGenerate = [];
  const monstersSkipped = [];
  for (const m of allMonsters) {
    if (await iconExists(m.id)) {
      monstersSkipped.push(m);
    } else {
      monstersNeedGenerate.push(m);
    }
  }

  if (monstersSkipped.length > 0) {
    console.log(`[跳过] ${monstersSkipped.length} 个怪物图标已存在:`);
    for (const m of monstersSkipped) {
      console.log(`       - ${m.name}`);
    }
  }

  if (monstersNeedGenerate.length === 0) {
    console.log('\n✅ 所有怪物图标已存在，无需生成。');
    return;
  }

  console.log(`\n[生成] 需要生成 ${monstersNeedGenerate.length} 个怪物图标`);
  console.log(`[配置] 图标尺寸: ${CONFIG.iconSize}x${CONFIG.iconSize}`);
  console.log(`[配置] 雪碧图尺寸: ${CONFIG.gridSize}x${CONFIG.gridSize}`);
  console.log(`[配置] 输出目录: ${CONFIG.outputDir}`);
  console.log();

  const batches = [];
  for (let i = 0; i < monstersNeedGenerate.length; i += CONFIG.batchSize) {
    batches.push(monstersNeedGenerate.slice(i, i + CONFIG.batchSize));
  }

  console.log(`[分批] 共 ${batches.length} 个批次`);
  console.log();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`========================================`);
    console.log(`  批次 ${batchIdx + 1} / ${batches.length}`);
    console.log(`  怪物: ${batch.map((m) => m.name).join(', ')}`);
    console.log(`========================================`);

    try {
      const prompt = buildBatchPrompt(batch);
      const imageUrl = await generateSpriteSheet(prompt);

      const tempPath = path.join(CONFIG.outputDir, `__batch_${batchIdx + 1}_sprite.png`);
      await downloadImage(imageUrl, tempPath);

      const results = await splitSpriteSheet(tempPath, batch);

      try {
        await fs.unlink(tempPath);
        console.log(`[清理] 已删除临时文件`);
      } catch {
        // ignore
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      console.log(`[批次 ${batchIdx + 1}] 成功: ${successCount}, 失败: ${failCount}`);

      if (batchIdx < batches.length - 1) {
        console.log(`[等待] 10秒后继续下一批次...`);
        await sleep(10000);
      }
    } catch (err) {
      console.error(`\n❌ 批次 ${batchIdx + 1} 失败: ${err.message}`);
      if (batchIdx < batches.length - 1) {
        console.log(`[等待] 10秒后继续下一批次...`);
        await sleep(10000);
      }
    }

    console.log();
  }

  console.log('========================================');
  console.log('  生成完成');
  console.log('========================================');

  const finalStatus = [];
  for (const m of allMonsters) {
    const exists = await iconExists(m.id);
    finalStatus.push({ name: m.name, exists });
  }

  const totalExists = finalStatus.filter((s) => s.exists).length;
  console.log(`\n总计: ${totalExists}/${allMonsters.length} 个怪物图标已生成`);

  if (totalExists < allMonsters.length) {
    console.log('\n缺失的图标:');
    for (const s of finalStatus) {
      if (!s.exists) {
        console.log(`  - ${s.name}`);
      }
    }
    process.exit(1);
  }

  console.log('\n✅ 所有怪物图标生成成功！');
}

main().catch((err) => {
  console.error('\n❌ 脚本执行失败:', err.message);
  process.exit(1);
});
