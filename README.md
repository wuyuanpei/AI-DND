# AI-DND

一个由大语言模型（LLM）全程驱动的 D&D 风格桌面角色扮演游戏。玩家通过与 AI 地下城主（DM）对话来创建角色、购买装备、推进剧情。所有游戏逻辑围绕 LLM 交互构建，DM 不仅扮演叙事者，还负责角色创建引导、商店交易和冒险剧情推进。

## 核心架构

### 1. 三阶段 DM 交互引擎

游戏将 DM 对话划分为三个严格隔离的阶段，每个阶段拥有独立的对话历史、系统提示词和持久化存储：

| 阶段 | 系统提示词 | 历史存储 Key | 核心行为 |
|------|-----------|-------------|---------|
| **creation** | `DM_CHARACTER_CREATION_PROMPT` | `creation` | 引导玩家创建角色，收集姓名、性别、外貌、性格、背景，分配四维属性（STR/AGI/INT/CHA，总和 50，每项 8-16） |
| **shop** | `DM_SHOP_PROMPT` | `shopping` | 扮演营地商人，根据玩家金币推荐初始装备。玩家确认后返回 `startAdventure: true` 进入下一阶段 |
| **adventure** | `DM_BASE_PROMPT` | `adventure` | 推进主线剧情，描述场景、NPC、战斗结果，驱动玩家探索 |

**阶段切换规则：**
- 角色创建完成后自动进入 `shop` 阶段，并清空 `creation` 历史
- 商店阶段玩家表达"开始冒险"意愿后进入 `adventure` 阶段，并清空 `shopping` 历史
- 每阶段历史独立保存在 IndexedDB 中，刷新页面后按当前 `dmPhase` 恢复对应历史

**动态玩家上下文注入：**
- `shop` 和 `adventure` 阶段每次请求都会向系统提示词注入实时玩家数据（`src/utils/dmPrompt.ts`）
- 包含：基本信息、HP/MP、金币、四维属性、负重、装备列表、技能列表、背包物品

### 2. LLM 通信协议

DM 与前端通过严格的 **JSON 协议** 通信（`src/utils/parseLLMJson.ts`）。大模型返回的 JSON 被解析后驱动 UI 状态：

```json
{
  "dialogue": "DM 对玩家说的话",
  "options": ["选项一", "选项二"],
  "character": { /* 仅在 creation 完成时出现 */ },
  "startAdventure": false /* 仅在 shop 阶段，准备冒险时设为 true */
}
```

- `dialogue`：渲染到对话栏的文本内容
- `options`：转化为对话栏下方的可点击按钮（0-5 个）
- `character`：触发角色创建，写入 `playerStore`
- `startAdventure`：触发阶段切换到 `adventure`

历史上下文中仅保留 `dialogue` 文本，不保存完整 JSON 或 `options`。

### 3. 数据持久化（IndexedDB）

所有核心数据存储在浏览器 IndexedDB（`ai-dnd-player`），不使用 localStorage 保存大段文本或对话历史：

| Store | Key | 内容 |
|-------|-----|------|
| `playerData` | `playerJson` | 玩家文本信息（姓名、性别、外貌、性格、背景） |
| `playerData` | `avatar` | 角色头像 Blob |
| `playerData` | `dmPhase` | 当前 DM 阶段 |
| `dialogueHistory` | `creation` / `shopping` / `adventure` | 各阶段可见对话历史（不含 system） |
| `gameLogs` | `logs` | 系统日志 |

localStorage 仅用于保存快速变化的数值状态（`ai-dnd-player-stats`）：等级、HP/MP、经验、金币、四维属性、负重上限等。

### 4. 状态管理（Zustand）

- **`playerStore`**（`src/store/playerStore.ts`）：玩家核心状态。创建角色时按公式计算初始值：`maxHp = 10×STR + 5×AGI`、`maxMp = 10×INT`、`gold = 10×CHA`、`weightLimit = 10×STR`
- **`dialogueStore`**（`src/store/dialogueStore.ts`）：对话状态、Tab 管理、DM 阶段切换、按 NPC 隔离的对话历史
- **`settingsStore`**（`src/store/settingsStore.ts`）：API Key、模型选择（通义千问 / DeepSeek）、图片生成配置、API 调用统计
- **`logStore`**（`src/store/logStore.ts`）：游戏系统日志，持久化到 IndexedDB

### 5. 服务层

- **`src/services/qwen.ts`**：统一 LLM API 封装。支持多服务商切换，构造 `system + history + user` 的消息体发送请求
- **`src/services/imageGen.ts`**：角色头像生成服务，创建角色完成后自动调用

### 6. 自动头像生成

角色创建流程：
1. DM 返回 `character` JSON
2. 前端校验属性之和为 50
3. 创建角色并持久化
4. 调用 `generateCharacterPortrait()` 生成 AI 头像
5. 头像 Blob 存入 IndexedDB，DataURL 存入 playerStore
6. 自动切换 DM 到 `shop` 阶段

## 技术栈

- **React 19** + **TypeScript 6**
- **Vite 8**
- **Zustand 5**（状态管理）
- **TailwindCSS 4**（样式）
- **IndexedDB**（大段文本、头像、对话历史、日志持久化）

## 项目结构

```
src/
├── components/
│   ├── Dialogue/           # LLM 对话组件，三阶段切换核心
│   ├── Equipment/          # 装备栏
│   ├── Inventory/          # 背包（28 格）
│   ├── Layout/             # 主布局（GameLayout）
│   ├── GameLogs/           # 系统日志面板
│   ├── Memory/             # 玩家记忆卡片面板
│   ├── Rules/              # 游戏规则面板
│   ├── Settings/           # API 设置面板
│   ├── Spells/             # 技能栏
│   ├── Stats/              # 玩家属性面板
│   └── WorldPanel/         # 世界状态面板
├── config/
│   ├── dmConfig.ts         # DM 三阶段系统提示词
│   └── imageConfig.ts      # 头像生成提示词配置
├── services/
│   ├── qwen.ts             # LLM API 封装
│   └── imageGen.ts         # 图片生成服务
├── store/
│   ├── playerStore.ts      # 玩家状态
│   ├── dialogueStore.ts    # 对话与 DM 阶段状态
│   ├── settingsStore.ts    # 设置与 API 统计
│   ├── logStore.ts         # 游戏日志
│   └── worldStore.ts       # 世界状态（预留）
├── utils/
│   ├── playerDB.ts         # IndexedDB 读写封装
│   ├── playerStats.ts      # localStorage 数值持久化
│   ├── dmPrompt.ts         # 动态玩家上下文生成
│   └── parseLLMJson.ts     # LLM JSON 响应解析与容错
├── types/
│   └── index.ts            # 核心类型定义
└── App.tsx
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

## 配置说明

API Key 和模型选择仅通过界面右上角的 **设置** 按钮配置，支持：

- **通义千问**：`qwen3.5-flash`、`qwen3.6-plus` 等
- **DeepSeek**：`deepseek-chat`

图片生成服务需单独配置图片 API Key。

## 许可证

Apache License 2.0

Copyright (c) 2026 Yuanpei Wu

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
