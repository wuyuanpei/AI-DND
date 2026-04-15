# 删除 worldStore 中未使用的状态

## 背景
`worldStore.ts` 中剩余的 `flags` 和 `completedQuests` 状态当前没有任何组件读取或展示，属于死代码。

## 目标
清理 `src/store/worldStore.ts`，移除 `flags` 和 `completedQuests` 及其相关 actions。

## 方案
1. 修改 `src/store/worldStore.ts`：删除 `flags`、`completedQuests`、`setFlag`、`completeQuest`。
2. 修改 `src/store/saveSystem.ts`：加载存档时不再尝试恢复 `world` 状态中的已删除字段（`JSON.parse` 后 setState 传入对象会自动忽略 store 中不存在的字段，所以基本无需改动，但为了清晰可保留现状或简化）。

## 验证
运行 `npm run build`，确保 TypeScript 无报错。
