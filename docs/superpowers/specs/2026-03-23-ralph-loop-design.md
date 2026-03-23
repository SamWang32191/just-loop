# Ralph Loop Plugin Design

Date: 2026-03-23
Status: Draft reviewed with user

## Goal

在 `my-loop-plugin` 中建立一個正式的 plugin runtime，實作一個只包含 Ralph Loop 最小核心能力的插件。

此版本不追求完整複刻 `.reference/oh-my-openagent`，只保留最必要的 loop 行為與宿主整合。

## Scope

### In Scope
- 正式 plugin runtime 骨架
- `/ralph-loop` 與 `/cancel-ralph` 命令入口
- 單一 active loop state
- completion promise 偵測
- continuation prompt 注入
- `session.idle` 驅動的迭代循環
- `session.deleted` / `session.error` 的 state 清理
- state-store 持久化到 `.loop/ralph-loop.local.md`
- 第一版採 `continue-only` 策略
- `.loop/` 目錄建立與 `.gitignore` 更新

### Out of Scope
- ultrawork / oracle verification 分支
- 完整複刻 oh-my-openagent 的 hook 生態
- 多 loop 並行
- reset strategy 實作

## Architecture

系統分成兩層：

1. **Plugin Shell**
   - 負責 OpenCode plugin 初始化與 hook 註冊
   - 接收 `chat.message` 與 `event`
   - 轉呼叫 Ralph Loop core
   - 收斂所有 `ctx.client.*` 宿主 API 相依

2. **Ralph Loop Core**
   - 負責 loop state、completion 偵測、iteration、continuation 注入決策
   - 不直接散落依賴 OpenCode 細節
   - 透過 `host-adapter` 取得 messages、送出 prompt、建立/中止 session 等能力

核心原則：plugin shell 很薄，Ralph Loop core 是主體；host 相依只留在 shell 與 adapter。

## Module Breakdown

### 1. `plugin-entry`
- plugin 初始化
- 建立 config
- 建立 Ralph Loop hook
- 導出 plugin 介面

### 2. `plugin-handlers`
- `chat.message`：攔 `/ralph-loop`、`/cancel-ralph`
- `event`：接 `session.idle / deleted / error` 並轉交 core

### 3. `commands`
- 解析 `/ralph-loop <task>`
- 支援 `--max`
- 支援 `--promise`
- 第一版固定 `continue-only`，不接受 `reset`
- 解析 `/cancel-ralph`

### 4. `loop-core`
- `startLoop`
- `cancelLoop`
- `handleEvent`
- `incrementIteration`
- `detectCompletion`
- `continueIteration`

### 5. `state-store`
- 專責讀寫 `.loop/ralph-loop.local.md`
- 只處理單一 active loop state
- 不承擔流程判斷

### 6. `host-adapter`
- 封裝宿主能力：
  - `getMessages(sessionID)`
  - `prompt(sessionID, text)`
  - `abortSession()`

第一版不需要 `createSession()` 與 `selectSession()`，避免為 reset 策略預留過多不必要介面。

## Data Flow

1. 使用者在既有 session 輸入 `/ralph-loop ...`
2. `commands` 解析 task、`maxIterations`、`completionPromise`
3. `plugin-handlers/chat.message` 先檢查是否已有 active loop：
   - 若 active loop 綁定的 session 仍存在，拒絕新的 `/ralph-loop`
   - 若 state 已 stale，先清理再繼續啟動
4. 啟動時不額外重送第一輪任務；第一輪任務以使用者當前這則 `/ralph-loop ...` 訊息承載
5. `plugin-handlers/chat.message` 呼叫 `loop-core.startLoop(sessionID, prompt, options)`
6. `loop-core.startLoop()` 立即記錄 message boundary（例如 `message_count_at_start`）
7. `state-store` 將 active state 寫到 `.loop/ralph-loop.local.md`
8. host 發出 `session.idle`
9. `plugin-handlers/event` 呼叫 `loop-core.handleEvent()`
10. `loop-core` 讀取 state，檢查 session 是否匹配並做 in-flight guard
11. `completion-detector` 只掃 loop 啟動後的新 assistant 訊息；資料來源可為 transcript 或 session messages API
12. 若命中 completion promise：clear state，結束 loop
13. 若未完成且未超過上限：iteration +1，建立 continuation prompt，透過 `host-adapter.prompt()` 注入下一輪
14. 若 session 被刪除或出錯：清理 state，避免 orphaned loop

## Storage

### State Path
- 固定使用：`.loop/ralph-loop.local.md`

### Recommended State Fields
- `active`
- `session_id`
- `prompt`
- `iteration`
- `max_iterations`
- `completion_promise`
- `message_count_at_start`
- `started_at`

### Completion Boundary Rule
- `message_count_at_start` 必須在 loop 啟動時立即捕捉
- completion 偵測只掃 loop 啟動之後新增的 assistant text
- 不應命中 loop 啟動前的舊訊息，也不應命中使用者自己的文字

### Single Active Loop Policy
- 系統只允許單一 active loop
- 收到新的 `/ralph-loop` 時：
  - 若既有 active loop session 仍存在：拒絕啟動並提示使用者先 `/cancel-ralph`
  - 若既有 state 對應 session 不存在：清理 stale state，再啟動新 loop

## Risks and Mitigations

### 1. Host API coupling
- **Risk:** 參考插件高度耦合 OpenCode session API
- **Mitigation:** 所有宿主能力都收斂到 `host-adapter`

### 2. Duplicate idle triggers
- **Risk:** `session.idle` 可能重複觸發，導致重複注入 continuation
- **Mitigation:** 保留 in-flight guard，必要時補 session recovery guard

### 3. Orphaned state
- **Risk:** state 檔與真實 session 脫節
- **Mitigation:** 在 `session.deleted` / `session.error` 清理 state

### 4. Over-scoping reset strategy
- **Risk:** 第一版若同時完整實作 reset 與 continue，複雜度升高
- **Mitigation:** 第一版只實作 `continue-only`，不暴露 reset 介面

### 5. Local state hygiene
- **Risk:** `.loop/` 下的本地 state 被誤提交到版本控制
- **Mitigation:** 在第一版一併建立 `.loop/` 目錄規則並更新 `.gitignore`

## Testing Strategy

### Unit Tests
- `commands` 參數解析
- `state-store` 對 `.loop/ralph-loop.local.md` 的讀寫
- `completion-detector` 對 transcript / messages 的偵測
- `loop-core.handleEvent()` 的路徑：
  - done
  - continue
  - max iterations reached
  - session deleted
  - session error

### Integration Test
- mock `host-adapter`
- 驗證 loop 在 idle 後會注入下一輪 prompt
- 驗證命中 completion promise 後不再繼續

## Recommended Implementation Order

1. 建立最小 plugin runtime 骨架
2. 更新 `.gitignore` 並定義 `.loop/` 本地 state 規則
3. 實作 `state-store`
4. 實作 `commands`
5. 實作 `host-adapter`
6. 實作 `loop-core.startLoop/cancelLoop`
7. 實作 `loop-core.handleEvent` 與 completion detector
8. 補 unit/integration tests

## Notes

- 本設計以 `.reference/oh-my-openagent` 的 Ralph Loop 為參考，但不沿用其 `.sisyphus` state path。
- 本專案 state path 已固定為 `.loop/ralph-loop.local.md`。
- 本文件描述的是第一版最小可行 plugin 設計。
