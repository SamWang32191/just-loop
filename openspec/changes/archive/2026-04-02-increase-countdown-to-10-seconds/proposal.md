## Why

目前 Ralph Loop 的 continuation 倒數只有 5 秒，對需要閱讀最新輸出、判斷是否該中斷，或在注入前做手動介入的使用者來說，緩衝時間偏短。將倒數拉長到 10 秒，可降低誤續跑的機率，並讓 countdown 提示更符合實際操作節奏。

## What Changes

- 將 continuation prompt 注入前的固定 countdown 從 5 秒調整為 10 秒。
- 將使用者可見的 toast 倒數提示改為顯示 10→9→8→7→6→5→4→3→2→1。
- 更新對應需求文件與測試，讓 spec、實作與驗證都一致反映 10 秒行為。

## Capabilities

### New Capabilities

### Modified Capabilities
- `prompt-injection-countdown`: 將 continuation 注入等待窗與倒數顯示序列從 5 秒改為 10 秒。

## Impact

- `src/ralph-loop/constants.ts` 的 countdown 常數
- `src/ralph-loop/loop-core.ts` 的 countdown 提示與等待流程
- `openspec/specs/prompt-injection-countdown/spec.md` 的 requirement 與 scenarios
- `tests/ralph-loop/loop-core.test.ts` 的 countdown 相關測試
