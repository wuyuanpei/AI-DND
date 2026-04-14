# AI-DND

一个基于 React + TypeScript + Vite 的 DND 风格角色扮演游戏。使用 DeepSeek API 实现与 NPC 的智能对话。

## 技术栈

- **React 19** - UI 框架
- **TypeScript 6** - 类型系统
- **Vite 8** - 构建工具
- **Zustand 5** - 状态管理
- **TailwindCSS 4** - 样式

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 核心系统

### 1. 玩家系统 (`src/store/playerStore.ts`)

管理玩家的所有状态和属性。

**玩家属性：**
- `name`: 玩家名称
- `level`: 等级 (1-10)
- `hp/maxHp`: 生命值
- `mp/maxMp`: 魔法值
- `exp`: 经验值
- `gold`: 金币
- `strength`: 力量
- `agility`: 敏捷
- `intelligence`: 智力
- `charisma`: 魅力

**装备系统：**
- 9 个装备槽：头盔、护甲、盾牌、主武器、副武器、远程、上衣、裤子、鞋子

**背包系统：**
- 20 个格子，使用数字索引存储物品
- 重量上限：50

**技能系统：**
- 初始 3 个技能槽，每级 +1
- 满级 (10 级) 时 12 个技能槽
- 公式：`技能上限 = 3 + (等级 - 1)`

### 2. 世界系统 (`src/store/worldStore.ts`)

管理地图、NPC、传送门等游戏世界元素。

**地图数据结构：**
```typescript
interface MapData {
  id: string;           // 地图 ID
  name: string;         // 地图名称
  background: string;   // 背景图片路径
  width: number;        // 地图宽度 (默认 1024)
  height: number;       // 地图高度 (默认 768, 4:3 比例)
  markers: Marker[];    // 地图上的标记
  collisions: Collision[]; // 碰撞区域
}
```

**标记类型：**
- `npc`: NPC 角色
- `door`: 传送门/门
- `enemy`: 敌人
- `player`: 玩家
- `item`: 物品

### 3. 对话系统 (`src/store/dialogueStore.ts`)

支持两种对话模式：
- **脚本模式**: 预定义的对话节点和选项
- **LLM 模式**: 使用 DeepSeek API 进行智能对话

**特性：**
- 按 NPC 存储对话历史
- 关闭对话后保留记录
- 再次对话时恢复历史

### 4. 地图系统 (`src/components/Map/Map.tsx`)

**移动控制：**
- WASD 或 方向键移动
- 移动速度可配置

**碰撞检测：**
- 矩形碰撞区域
- 圆形碰撞区域
- 边界检查

**地图标记渲染：**
- P (蓝色) - 玩家
- N (黄色) - NPC
- D (紫色) - 传送门
- E (红色) - 敌人

### 5. DeepSeek API 对话 (`src/services/deepseek.ts`)

调用 DeepSeek API 实现 NPC 智能对话。

**API 配置：**
- URL: `https://api.deepseek.com/v1/chat/completions`
- 模型：`deepseek-chat`
- temperature: 0.7
- max_tokens: 100

**返回格式：**
```typescript
interface ChatResponse {
  content: string;           // AI 回复内容
  usage: {
    promptTokens: number;        // 输入 token 数
    completionTokens: number;    // 输出 token 数
    totalTokens: number;         // 总 token 数
  }
}
```

**API 统计：**
- 自动统计调用次数和 token 消耗量
- 数据持久化到 localStorage
- 在游戏界面底部实时显示

### 6. 存档系统 (`src/store/saveSystem.ts`)

使用 LocalStorage 保存游戏进度。

**存档内容：**
- 玩家状态
- 世界状态
- 设置（包括 API Key）
- 存档时间戳

**API Key 持久化：**
- 单独存储在 `ai-dnd-deepseek-api-key`
- 重启后仍然存在

### 7. 对话系统特性 (`src/store/dialogueStore.ts`)

**Tab 多对话管理：**
- 默认 DM 标签页（始终存在，无法关闭）
- NPC 标签页动态创建，可关闭
- 每个 NPC 独立的对话历史
- 切换标签页时保留各自的加载状态

**距离检测：**
- NPC 在交互范围内（50px）时可对话
- 离开范围后输入框禁用，显示"已离开"提示
- DM 始终可对话（不受距离限制）

**异步处理：**
- 请求时保存当前 NPC ID，防止切换导致消息错乱
- 每个 NPC 独立的 loading 状态
- "思考中..."与对应标签页绑定

## 可配置选项

### 玩家配置 (`src/store/playerStore.ts`)

```typescript
export const INVENTORY_SLOTS = 20;      // 背包格子数量
export const BASE_SKILL_SLOTS = 3;      // 基础技能槽数量
export const MAX_LEVEL = 10;            // 最大等级
export const WEIGHT_LIMIT = 50;         // 背包重量上限
```

### 地图配置 (`src/store/worldStore.ts`)

```typescript
const defaultMapData = {
  width: 1024,    // 地图宽度
  height: 768,    // 地图高度 (4:3 比例)
  // ... 其他配置
};
```

### 移动速度 (`src/store/settingsStore.ts`)

```typescript
moveSpeed: 10;        // 玩家移动速度
interactionRange: 50; // NPC 交互范围
```

### API 配置 (`src/services/deepseek.ts`)

```typescript
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
// 可在 chatWithNPC 函数中调整：
// - temperature: 0.7  (创造力，0-2)
// - max_tokens: 100   (最大输出长度)
```

### API 统计配置 (`src/store/settingsStore.ts`)

**统计数据持久化：**
- 存储键：`ai-dnd-api-stats`
- 包含字段：
  - `apiCallCount`: API 调用总次数
  - `totalPromptTokens`: 输入 token 总数
  - `totalCompletionTokens`: 输出 token 总数
  - `totalTokens`: token 总消耗量

**重置统计：**
```typescript
useSettingsStore.getState().resetStats();  // 清空统计数据
```

### 游戏规则 (`src/data/rules.json`)

以 JSON 格式存储游戏规则文档，支持多个 Tab：
- 技能
- 属性
- 装备
- 战斗

## 项目结构

```
src/
├── components/
│   ├── Dialogue/       # 对话组件
│   ├── Equipment/      # 装备栏
│   ├── Inventory/      # 背包
│   ├── Layout/         # 主布局
│   ├── Map/           # 地图及标记
│   ├── Rules/         # 规则面板
│   ├── Settings/      # 设置
│   ├── Spells/        # 技能栏
│   ├── Stats/         # 玩家状态
│   └── WorldPanel/    # 世界状态面板
├── data/
│   └── rules.json     # 游戏规则文档
├── services/
│   └── deepseek.ts    # DeepSeek API 服务
├── store/
│   ├── dialogueStore.ts  # 对话状态
│   ├── playerStore.ts    # 玩家状态
│   ├── saveSystem.ts     # 存档系统
│   ├── settingsStore.ts  # 设置状态
│   └── worldStore.ts     # 世界状态
├── types/
│   └── index.ts       # TypeScript 类型定义
└── main.tsx           # 入口文件
```

## 游戏布局

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌────────┐  ┌──────────────────────┐  ┌────────────────────────┐    │
│  │        │  │                      │  │  冒险者状态 (522px)    │    │
│  │ 世界   │  │                      │  ├────────────────────────┤   │
│  │ 状态   │  │       地 图          │  │  装备 (230px, 3x3)     │    │
│  │        │  │     (1024x768)       │  └────────────────────────┘    │
│  │        │  │                      │                                 │
│  └────────┘  └──────────────────────┘                                 │
│  ┌────────────┐  ┌─────────────────────────┐  ┌───────────────────┐   │
│  │ 背包 (4x5) │  │      对 话 栏           │  │  技能 (3x3)       │   │
│  │ 420px      │  │      420px              │  │  420px            │   │
│  └────────────┘  └─────────────────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## 操作说明

| 按键 | 功能 |
|------|------|
| W/↑ | 向上移动 |
| S/↓ | 向下移动 |
| A/← | 向左移动 |
| D/→ | 向右移动 |
| 点击 NPC | 打开对话 |
| Enter | 发送消息 |

## 扩展指南

### 添加新地图

在 `worldStore.ts` 中添加新的 `MapData`：

```typescript
const newMapData: MapData = {
  id: 'forest',
  name: '森林',
  background: '/assets/maps/forest.png',
  width: 1024,
  height: 768,
  markers: [
    // 添加 NPC、传送门、敌人等
  ],
  collisions: [
    // 添加碰撞区域
  ]
};
```

### 添加新物品类型

在 `types/index.ts` 中扩展 `Item` 类型：

```typescript
export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'helmet' | 'boots' | 'consumable' | /* 新类型 */;
  description: string;
  stats?: Record<string, number>;
}
```

### 自定义 NPC 对话

在 `rules.json` 中添加对话规则，或修改 `deepseek.ts` 中的系统提示词：

```typescript
const systemPrompt = `你是 DND 游戏中的${npcName}。请用中世纪奇幻风格与玩家对话，保持简短（不超过 50 字）。`;
```

## 剧本格式

剧本是一个 `.md` 文件，通过右上角「📖 剧本」按钮导入。文件格式由 **YAML frontmatter** + **Markdown 正文** 两部分组成。

### YAML frontmatter（必须）

位于文件顶部，用 `---` 分隔。包含以下字段：

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 剧本标题 |
| `description` | string | ❌ | 剧本简介 |
| `author` | string | ❌ | 作者名 |
| `dmPrompt` | string (多行) | ✅ | 给 DM 的提示词，作为 DM 对话的上下文 |
| `acts` | array | ❌ | 幕列表（见下方结构） |
| `npcs` | array | ❌ | NPC 列表（见下方结构） |

### `acts` 结构

每幕是一个对象：

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | ❌ | 幕的唯一标识（如 `act1`） |
| `title` | string | ❌ | 幕标题 |
| `synopsis` | string | ❌ | 幕概要 |

### `npcs` 结构

每个 NPC 是一个对象：

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | ❌ | NPC 的唯一标识，需与地图 Marker 的 `id` 匹配才能生效 |
| `name` | string | ❌ | NPC 显示名称 |
| `personality` | string | ❌ | 性格描述 |
| `background` | string | ❌ | 背景故事 |
| `dialogueStyle` | string | ❌ | 对话风格描述 |
| `systemPrompt` | string (多行) | ❌ | 给该 NPC 的完整系统提示词，将替代默认提示发送给 LLM |
| `stats` | object | ❌ | 四维能力数值（见下方结构） |

### `stats` 结构

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `strength` | number | 10 | 力量 |
| `agility` | number | 10 | 敏捷 |
| `intelligence` | number | 10 | 智力 |
| `charisma` | number | 10 | 魅力 |

### Markdown 正文（可选）

`---` 分隔符之后是剧本的 Markdown 正文，包含剧情描述、场景、对话等内容。这部分不会发送给 LLM，仅用于创作者参考和剧本管理面板中预览。

### 示例文件

参考项目中的 `src/data/example-script.md`，包含完整的三幕剧情和 10 个 NPC。

### 示例格式

```markdown
---
title: "剧本标题"
description: "剧本简介"
author: "作者名"
acts:
  - id: act1
    title: "第一幕标题"
    synopsis: "第一幕概要"
dmPrompt: |
  给DM的提示词，作为DM对话的上下文
  可以多行书写
npcs:
  - id: npc_elder
    name: "村长"
    personality: "性格描述"
    background: "背景故事"
    dialogueStyle: "对话风格"
    systemPrompt: |
      给该NPC的完整系统提示词
      将替代默认提示发送给LLM
    stats:
      strength: 8
      agility: 5
      intelligence: 12
      charisma: 10
---

# 第一幕
剧情正文...
```

## 最近修改

### Tab 对话系统
- 添加 DM 永久标签页（游戏主持人，驱动游戏进程）
- NPC 标签页动态创建，点击 X 关闭
- 每个 NPC 独立的对话历史和加载状态
- 距离检测：NPC 离开范围后输入框禁用
- 异步请求绑定原 NPC ID，防止切换导致消息错乱

### API 统计功能
- 自动统计 DeepSeek API 调用次数
- 统计 Prompt/Completion/Total Token 消耗
- 数据持久化到 localStorage
- 界面底部实时显示统计信息

### 其他优化
- 修复切换标签页时消息丢失问题
- 修复思考中状态与标签页绑定
- 移除隐藏标签页功能，简化交互

## 许可证

MIT
