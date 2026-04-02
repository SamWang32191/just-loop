## Why

目前 Ralph Loop 在偵測到需要 continuation 時會立即注入下一次 prompt，使用者沒有明確的緩衝時間確認是否要繼續。這會讓「其實想先打斷或略過下一次注入」的情境變得笨重，也增加誤觸續跑的風險。

## What Changes

- 在實際注入 continuation prompt 前加入固定 5 秒倒數。
- 在倒數開始時透過 OpenCode TUI toast 顯示即將注入與取消方式。
- 倒數期間提供使用者可主動取消「下一次注入」的控制方式。
- 取消必須是 one-shot：只略過當前排定的下一次注入，後續偵測到新的 continuation 時仍可正常排程。
- 讓倒數、取消、狀態消耗與既有 `skip_next_continuation` / interrupt 邏輯一致，避免重複注入或永久停用 loop。
- 補齊對應測試，覆蓋倒數完成注入、倒數期間取消、取消只生效一次等行為。

## Capabilities

### New Capabilities
- `prompt-injection-countdown`: 在 continuation prompt 注入前提供可觀察、可一次性取消的倒數控制。

### Modified Capabilities

## Impact

- `src/ralph-loop/loop-core.ts` 的 idle 後續跑與狀態轉移
- `src/ralph-loop/types.ts`、`src/ralph-loop/state-store.ts` 的 countdown / one-shot cancel 狀態欄位
- `src/plugin/*`、`src/host-adapter/*` 需要新增 `showToast` 倒數提示或通知整合
- `src/commands/*` 若採命令式取消，需補 command parser 與 command surface
- `tests/ralph-loop/*` 與相關整合測試
