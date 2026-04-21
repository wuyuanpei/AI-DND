#!/usr/bin/env node
/**
 * 武器图标批量生成脚本
 *
 * 使用通义千问 qwen-image-2.0 批量生成武器图标。
 * 每批生成 9 个武器图标（3x3 雪碧图），然后分割为 512x512 的独立图标。
 *
 * 用法：
 *   DASHSCOPE_API_KEY=your_key node scripts/generate-weapon-icons.mjs
 *
 * 可选环境变量：
 *   DASHSCOPE_API_KEY    - 必填，DashScope API Key
 *   DASHSCOPE_API_URL    - 可选，默认 https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
 *   ICON_SIZE            - 可选，单个图标尺寸，默认 512
 *   GRID_SIZE            - 可选，雪碧图尺寸（ICON_SIZE * 3），默认 1536
 *   OUTPUT_DIR           - 可选，输出目录，默认 ../public/weapons
 *   WEAPONS_JSON         - 可选，武器数据文件路径，默认 ../src/data/weapons.json
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
  gridSize: parseInt(process.env.GRID_SIZE, 10) || 1536,
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, '../public/weapons'),
  weaponsJson: process.env.WEAPONS_JSON || path.resolve(__dirname, '../src/data/weapons.json'),
  batchSize: 9,
};

// ============ 颜色映射（用于提示词增强） ============
const RARITY_EN = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
};

// ============ 工具函数 ============

/**
 * 确保目录存在
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // 忽略已存在错误
  }
}

/**
 * 读取武器数据
 */
async function loadWeapons() {
  const raw = await fs.readFile(CONFIG.weaponsJson, 'utf-8');
  const data = JSON.parse(raw);
  return data.weapons || [];
}

/**
 * 检查某个武器图标是否已存在
 */
async function iconExists(weaponId) {
  try {
    const iconPath = path.join(CONFIG.outputDir, `${weaponId}.png`);
    await fs.access(iconPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 构建批量生成提示词
 * @param {Array} weapons - 当前批次的武器数组
 * @param {number} batchIndex - 批次索引
 */
function buildBatchPrompt(weapons, batchIndex) {
  const iconSize = CONFIG.iconSize;
  const gridSize = CONFIG.gridSize;

  let prompt = `请生成一组共 ${weapons.length} 个独立的奇幻中世纪风格武器道具图标，并将它们组合成一张 ${Math.ceil(Math.sqrt(weapons.length))}×${Math.ceil(Math.sqrt(weapons.length))} 网格的雪碧图（Sprite Sheet）。

画布尺寸：${gridSize}×${gridSize} 像素（对应网格，每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！每个图标 ${iconSize}×${iconSize} 像素，请确保均匀分布！）。
图标格式：每个图标必须是透明背景，边缘无锯齿，适合游戏引擎调用。
美术风格：奇幻中世纪风格，参考《龙与地下城》的写实质感，每个武器图标单独呈现，有明显的道具感，适合作为游戏UI图标使用。武器应正面或45度角展示，有适当的光影和金属质感。背景必须透明。

武器列表（请严格按照以下顺序排列）：\n`;

  // 按网格位置排列
  let gridCol = Math.ceil(Math.sqrt(weapons.length));
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const row = Math.floor(i / gridCol) + 1;
    const col = (i % gridCol) + 1;
    prompt += `\n${i + 1}、第${row}排第${col}个：${w.name}，${w.description}`;
    prompt += `。`;
  }

  prompt += `\n\n重要要求：
1. 必须严格按上述顺序和网格位置排列，每个武器占据一个格子。
2. 每个武器图标必须是 ${iconSize}×${iconSize} 像素大小。
3. 整个画布必须是 ${gridSize}×${gridSize} 像素。
4. 每个武器图标之间要有明显的间距和分隔，不要重叠。
5. 背景必须是纯白色的。
6. 输出一张完整的雪碧图。`;

  return prompt;
}

/**
 * 调用 DashScope API 生成图片
 */
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
      // 忽略 JSON 解析错误
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  // 提取图片 URL
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

/**
 * 下载图片到临时路径
 */
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

/**
 * 分割雪碧图为独立的图标
 */
async function splitSpriteSheet(spritePath, weapons, batchIndex) {
  const iconSize = CONFIG.iconSize;
  const gridCol = Math.ceil(Math.sqrt(weapons.length));

  console.log(`[分割] 正在分割雪碧图，网格: ${gridCol}x${gridCol}，图标尺寸: ${iconSize}x${iconSize}`);

  const results = [];
  for (let i = 0; i < weapons.length; i++) {
    const weapon = weapons[i];
    const row = Math.floor(i / gridCol);
    const col = i % gridCol;

    // 计算裁剪区域
    const left = col * iconSize;
    const top = row * iconSize;

    const outputPath = path.join(CONFIG.outputDir, `${weapon.id}.png`);

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

      results.push({ weapon, path: outputPath, success: true });
      console.log(`[分割] ✓ ${weapon.name} -> ${path.relative(process.cwd(), outputPath)}`);
    } catch (err) {
      results.push({ weapon, path: outputPath, success: false, error: err.message });
      console.error(`[分割] ✗ ${weapon.name} 分割失败: ${err.message}`);
    }
  }

  return results;
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 主流程 ============

async function main() {
  console.log('========================================');
  console.log('  武器图标批量生成脚本');
  console.log('========================================');
  console.log();

  // 检查 API Key
  if (!CONFIG.apiKey) {
    console.error('❌ 错误: 未设置 DASHSCOPE_API_KEY 环境变量');
    console.error('   请设置后再运行，例如:');
    console.error('   DASHSCOPE_API_KEY=your_key node scripts/generate-weapon-icons.mjs');
    process.exit(1);
  }

  // 加载武器数据
  console.log('[加载] 读取武器数据...');
  const allWeapons = await loadWeapons();
  console.log(`[加载] 共 ${allWeapons.length} 个武器`);

  // 确保输出目录存在
  await ensureDir(CONFIG.outputDir);

  // 过滤掉已存在的图标
  const weaponsNeedGenerate = [];
  const weaponsSkipped = [];
  for (const w of allWeapons) {
    if (await iconExists(w.id)) {
      weaponsSkipped.push(w);
    } else {
      weaponsNeedGenerate.push(w);
    }
  }

  if (weaponsSkipped.length > 0) {
    console.log(`[跳过] ${weaponsSkipped.length} 个武器图标已存在:`);
    for (const w of weaponsSkipped) {
      console.log(`       - ${w.name}`);
    }
  }

  if (weaponsNeedGenerate.length === 0) {
    console.log('\n✅ 所有武器图标已存在，无需生成。');
    return;
  }

  console.log(`\n[生成] 需要生成 ${weaponsNeedGenerate.length} 个武器图标`);
  console.log(`[配置] 图标尺寸: ${CONFIG.iconSize}x${CONFIG.iconSize}`);
  console.log(`[配置] 雪碧图尺寸: ${CONFIG.gridSize}x${CONFIG.gridSize}`);
  console.log(`[配置] 输出目录: ${CONFIG.outputDir}`);
  console.log();

  // 分批处理
  const batches = [];
  for (let i = 0; i < weaponsNeedGenerate.length; i += CONFIG.batchSize) {
    batches.push(weaponsNeedGenerate.slice(i, i + CONFIG.batchSize));
  }

  console.log(`[分批] 共 ${batches.length} 个批次`);
  console.log();

  // 处理每一批
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`========================================`);
    console.log(`  批次 ${batchIdx + 1} / ${batches.length}`);
    console.log(`  武器: ${batch.map((w) => w.name).join(', ')}`);
    console.log(`========================================`);

    try {
      // 构建提示词
      const prompt = buildBatchPrompt(batch, batchIdx);

      // 生成雪碧图
      const imageUrl = await generateSpriteSheet(prompt);

      // 下载到临时文件
      const tempPath = path.join(CONFIG.outputDir, `__batch_${batchIdx + 1}_sprite.png`);
      await downloadImage(imageUrl, tempPath);

      // 分割雪碧图
      const results = await splitSpriteSheet(tempPath, batch, batchIdx);

      // 清理临时文件
      try {
        await fs.unlink(tempPath);
        console.log(`[清理] 已删除临时文件`);
      } catch {
        // 忽略删除错误
      }

      // 统计结果
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      console.log(`[批次 ${batchIdx + 1}] 成功: ${successCount}, 失败: ${failCount}`);

      // 批次间延迟（避免API限流）
      if (batchIdx < batches.length - 1) {
        console.log(`[等待] 10秒后继续下一批次...`);
        await sleep(10000);
      }
    } catch (err) {
      console.error(`\n❌ 批次 ${batchIdx + 1} 失败: ${err.message}`);
      // 继续下一批
      if (batchIdx < batches.length - 1) {
        console.log(`[等待] 10秒后继续下一批次...`);
        await sleep(10000);
      }
    }

    console.log();
  }

  // 最终统计
  console.log('========================================');
  console.log('  生成完成');
  console.log('========================================');

  // 检查最终结果
  const finalStatus = [];
  for (const w of allWeapons) {
    const exists = await iconExists(w.id);
    finalStatus.push({ name: w.name, exists });
  }

  const totalExists = finalStatus.filter((s) => s.exists).length;
  console.log(`\n总计: ${totalExists}/${allWeapons.length} 个武器图标已生成`);

  if (totalExists < allWeapons.length) {
    console.log('\n缺失的图标:');
    for (const s of finalStatus) {
      if (!s.exists) {
        console.log(`  - ${s.name}`);
      }
    }
    process.exit(1);
  }

  console.log('\n✅ 所有武器图标生成成功！');
}

// 运行主流程
main().catch((err) => {
  console.error('\n❌ 脚本执行失败:', err.message);
  process.exit(1);
});
