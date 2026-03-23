# Findings & Decisions

## Requirements
- 了解 `.reference/oh-my-openagent` 中 Ralph Loop feature 的實作、架構、與細節。
- 規劃如何在 `my-loop-plugin` 中做出一個「只有 Ralph Loop 功能」的 plugin。
- 目標範圍是最小核心 loop。
- 落地形式是正式 plugin runtime。

## Research Findings
- 參考插件中的 Ralph Loop 核心集中在 `src/hooks/ralph-loop/`。
- `createRalphLoopHook()` 對外介面很小：`event()`、`startLoop()`、`cancelLoop()`、`getState()`。
- `startLoop()` 會補抓 `messageCountAtStart`，讓 completion 掃描能只看 loop 啟動後的新訊息。
- 主要入口由 builtin commands 與 plugin hook/event system 串起：`/ralph-loop`、`/ulw-loop`、`/cancel-ralph`。
- 核心流程：startLoop 建立狀態 → `session.idle` 事件觸發 → 以 transcript 或 session messages API 偵測 completion promise → 完成則收尾，未完成則注入下一輪 continuation prompt。
- 參考插件的狀態會寫入 `.sisyphus/ralph-loop.local.md`，欄位包含 active、iteration、max_iterations、session_id、strategy、verification 狀態等。
- ultrawork 模式額外引入 verification pending / oracle verification 流程。
- event handler 有防重入設計：`inFlightSessions` + `sessionRecovery`。
- event handler 也會處理 `session.deleted` 與 `session.error`，降低 orphaned state 風險。
- 參考實作與 host plugin framework 高度耦合，尤其是 session create/messages/promptAsync/abort 與 TUI session selection。
- 目前 `my-loop-plugin` repo 本身不是傳統 TS/JS runtime 專案，比較像 OpenCode/OpenSpec 的命令/工作流骨架。
- 目前 repo 中最自然的承接位置是 `.opencode/command/` 與 `.opencode/skills/`，而非 `src/`。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 先抽象 Ralph Loop 的最小必要能力，再決定如何映射到本 repo | 參考實作與原 host 耦合高，直接照搬風險大 |
| 優先關注核心 loop engine 與命令入口，而非完整 host integration | 使用者目標是做只有 Ralph Loop 的 plugin |
| 應先建立最小 plugin runtime 骨架，再移植 Ralph Loop 核心 | 使用者要求正式 plugin runtime，而目前 repo 尚無 runtime 結構 |
| 採方案 A：薄殼 plugin + 移植 Ralph Loop 核心 | 平衡實作成本、可維護性、與對參考插件的貼近程度 |
| `state-store` 路徑改為 `.loop/ralph-loop.local.md` | 這是本專案明確要求，與參考插件的 `.sisyphus` 路徑脫鉤 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 目前 repo 缺少一般 runtime 程式結構 | 設計時需以 command/skill workflow 為主要落點 |
| 使用者改為要求正式 plugin runtime | 需把設計方向調整為新增 `src/` 插件骨架 |
| 我先前沿用參考插件的 `.sisyphus` 路徑描述 | 修正為本專案指定的 `.loop/ralph-loop.local.md` |

## Resources
- `.reference/oh-my-openagent/src/hooks/ralph-loop/`
- `.reference/oh-my-openagent/src/plugin/event.ts`
- `.reference/oh-my-openagent/src/plugin/chat-message.ts`
- `.reference/oh-my-openagent/src/plugin/tool-execute-before.ts`
- `.reference/oh-my-openagent/src/features/builtin-commands/templates/ralph-loop.ts`
- `.reference/oh-my-openagent/src/config/schema/ralph-loop.ts`
- `.opencode/command/`
- `openspec/config.yaml`

## Visual/Browser Findings
- 無
