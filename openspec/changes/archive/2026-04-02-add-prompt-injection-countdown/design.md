## Context

目前 `loop-core` 在 `session.idle` 判定需要 continuation 後，會直接呼叫 host adapter 的 `prompt()` 注入下一輪 prompt。專案已經有 one-shot `skip_next_continuation` 狀態與 `session.interrupt` 入口，可略過下一次 continuation，但現況沒有「注入前的緩衝時間」，因此使用者很難在下一輪 prompt 送出前主動攔截。

另外，OpenCode SDK 實際提供 `client.tui.showToast()`，可顯示 `title / message / variant / duration` 的 TUI toast；本專案目前尚未把這項能力包進 plugin/host adapter，因此本次除了 loop 行為調整，也要把 countdown 通知能力接進現有架構。

## Goals / Non-Goals

**Goals:**
- 在 continuation prompt 送出前加入固定 5 秒等待窗，並對使用者顯示 countdown toast。
- 讓使用者可在等待窗內透過既有 interrupt 控制取消這一次待送出的 continuation。
- 保持取消為 one-shot：只影響目前排定中的下一次注入，不影響後續新的 continuation 決策。
- 維持現有 active-loop-scoped race guard、state queue 與 duplicate idle 防護。

**Non-Goals:**
- 不新增新的前端頁面或複雜視覺元件；只使用 SDK 既有 TUI toast。
- 不把 `/cancel-ralph` 改成「只取消下一次注入」；它仍然代表取消整個 loop。
- 不擴充 reset strategy 或其他 Ralph Loop 行為面。

## Decisions

### 1. 倒數以 `loop-core` 內的 async delay 實作，而不是新增排程子系統

`handleEvent({ type: "session.idle" })` 在確認需要 continuation 後，不立刻呼叫 `prompt()`，而是先等待 5 秒，再重新讀取 state 決定是否仍應注入。這比新增獨立 timer registry 或背景排程更小、更符合目前單一 core 的架構，而且既有 `inFlight` guard 會自然抑制同 session 的重複 idle 事件。

考慮過的替代方案：
- **獨立 timer registry + persisted deadline**：可做得更顯式，但要新增更多 state 與 timer 清理邏輯，對這次需求過重。
- **只在 state 記 deadline，等下一個 event 再處理**：若 5 秒後沒有新 event，注入永遠不會發生，不可接受。

### 2. 沿用既有 `session.interrupt` / `skip_next_continuation` 作為取消入口

專案已經把 `tui.command.execute` 的 `session.interrupt` 映射成 active-loop-scoped 的 one-shot continuation skip。這次不新增新的 slash command，而是讓 countdown 期間也吃同一個旗標：若 5 秒等待期間收到 interrupt，就在倒數結束時消耗 `skip_next_continuation`，跳過這一次 prompt 注入。

考慮過的替代方案：
- **新增 `/cancel-next-ralph`**：語意更明確，但會擴大 command surface，也與現有 interrupt one-shot 行為重疊。
- **把 `/cancel-ralph` 改成條件式取消**：會混淆「取消整個 loop」與「只取消下一次注入」兩種不同責任。

### 3. 透過 host adapter/notification abstraction 暴露 `showToast`，避免把 UI SDK 細節散進 core

為了維持既有「plugin shell 很薄、loop core 為主體」的邊界，countdown toast 不直接在 `loop-core` 內觸碰 `ctx.client.tui.showToast()`，而是透過 host adapter 的可選通知能力（例如 `showToast(...)`）或獨立 notifier 依賴注入。這樣 `loop-core` 只表達「何時該通知」，不直接依賴 OpenCode SDK 的實作細節。

考慮過的替代方案：
- **在 plugin event handler 內管理所有 toast**：會把 countdown lifecycle 分散到 shell/core 兩邊，增加 race 與同步成本。
- **直接讓 `loop-core` 接收整個 plugin ctx**：最省事，但會破壞目前的 host abstraction。

### 4. countdown toast 明確要求每秒更新 5→4→3→2→1

本次 UX 要求不是單次提示，而是明確的倒數體驗。實作上應在 countdown 開始時立即顯示 `5s` toast，接著每秒更新一次，直到 `1s`。由於目前沒有看到 toast 更新 ID 或 replace contract，預期做法是每秒重新呼叫 `showToast` 送出新內容。

除了每秒倒數 toast 之外，注入成功、被取消、或 loop 被清理時，也應視情況補一則結果 toast，讓使用者知道 pending continuation 的最終 outcome。

### 5. 將 countdown 視為 pending continuation 狀態，而不是直接改 iteration

倒數開始時不應先遞增 iteration，也不應先寫入已處理完成的 continuation 結果。只有在 5 秒到期且確認仍需注入時，才真正送出 prompt 並提交 iteration / `last_message_count_processed` 更新。若倒數期間被取消、loop 被清理、session 消失，則這次 pending continuation 直接作廢。

這個做法可避免：
- 倒數中取消後 iteration 被誤算成已前進
- 舊 idle handler 在 cancel/restart 後覆蓋新 loop state
- completion / max-iterations 在倒數期間已滿足時仍誤送 prompt

### 6. 額外狀態僅保留 countdown 所需最小欄位

建議在 state 中加入最小 pending continuation 欄位，例如 `pending_continuation_started_at`、`pending_continuation_due_at`，必要時再補 `pending_continuation_message_count` 以辨識倒數所對應的 assistant batch。這些欄位只用來描述「目前有一個待注入 continuation 正在倒數」，不承擔新的長期模式切換責任。

之所以不只靠 `skip_next_continuation`，是因為 countdown 需要能明確分辨：
- 目前是否真的有待注入項目
- duplicate idle 是否應直接忽略
- interrupt 到底是在取消「倒數中的下一次注入」還是預先標記未來一次 skip

## Risks / Trade-offs

- **[等待 5 秒期間 core promise 尚未結束]** → 這會拉長單次 idle handler 的生命週期，但 Node event loop 不會被阻塞，且 `inFlight` guard 正好可以防止重複注入。
- **[`showToast` 可能以重複推送方式實現倒數]** → 若 TUI 會把每秒 toast 視為多則獨立通知，畫面可能較吵；但這是使用者明確要求的 UX，先以正確倒數語意為優先。
- **[倒數期間收到 cancel/restart/delete/error]** → 倒數結束前必須 re-read state 與 incarnation token，只有當 active loop 仍是同一個實例時才允許注入。
- **[interrupt 在非 countdown 期間的既有語意]** → 本次要保留既有 one-shot skip 行為，避免把 interrupt 限縮成只能在 countdown 期間生效。

## Migration Plan

1. 擴充 `RalphLoopState` 與 state-store 型別驗證，支援 pending continuation 欄位。
2. 擴充 plugin / host adapter，支援可選 `showToast` 通知能力。
3. 調整 `loop-core.handleEvent()`：在 continuation 決策與實際 `prompt()` 之間插入 5 秒 delay、toast lifecycle 與 pending-state lifecycle。
4. 保持 `session.interrupt` 現有入口，但讓 countdown 結束時能消耗 skip flag、清掉 pending state，並發出適當結果 toast。
5. 補單元測試，覆蓋 countdown 成功注入、每秒 toast 更新、countdown 期間取消、one-shot 消耗、cancel/restart race、session 清理等情境。

## Open Questions

- 若 TUI 對每秒 toast 重送的體驗不佳，是否需要後續再引入更適合的 status UI abstraction；本次先照需求實作每秒倒數。
