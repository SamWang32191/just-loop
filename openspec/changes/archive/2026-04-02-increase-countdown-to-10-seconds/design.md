## Context

Ralph Loop 已經有完整的 pending continuation countdown 機制，包含固定秒數常數、每秒 toast 更新、state 追蹤，以及對應 spec 與測試。這次需求不是新增行為模型，而是把既有 countdown 從 5 秒調整為 10 秒，並維持實作、需求文件與測試的語意一致。

## Goals / Non-Goals

**Goals:**
- 把 continuation 注入前的固定等待時間從 5 秒改為 10 秒。
- 讓使用者可見倒數提示完整反映 10→9→8→7→6→5→4→3→2→1。
- 更新 spec 與測試，避免常數、文件與驗證結果不一致。

**Non-Goals:**
- 不新增可設定 countdown 秒數的使用者配置。
- 不更動 interrupt/cancel 的 one-shot 行為。
- 不重構 countdown 狀態模型、toast abstraction 或 loop scheduling 架構。

## Decisions

### 1. 沿用既有 countdown 架構，只調整固定秒數常數與相依驗證

目前 countdown 已集中由 `CONTINUATION_COUNTDOWN_SECONDS` 驅動，`loop-core` 每秒遞減並更新 toast，測試也已覆蓋主要流程。最小且風險最低的做法，是直接把固定常數改為 10，並同步更新所有明確寫死 5 秒語意的 spec 與測試。

考慮過的替代方案：
- **新增可配置 countdown 秒數**：彈性更高，但需求只要求改成 10 秒，現在加入設定面會放大變更面與測試矩陣。
- **只改常數，不更新 spec/tests**：實作可能暫時可動，但文件與驗證會失真，後續維護成本更高。

### 2. 將這次變更視為既有 capability 的 requirement 修改，而不是新增 capability

`prompt-injection-countdown` 已存在主 spec，這次只是改變 countdown 的規範值與顯示序列，因此應以 delta spec 的 `MODIFIED Requirements` 更新既有 requirement，而不是新增獨立 capability。這能保持需求來源單一，避免 countdown 行為分散在多份 spec 中。

考慮過的替代方案：
- **新增一個 countdown-duration capability**：會讓單一功能拆成多份重疊 spec，沒有必要。

## Risks / Trade-offs

- **[等待時間變長可能讓自動續跑體感變慢]** → 這是需求刻意要增加的使用者決策窗，屬可接受 trade-off。
- **[若漏改任何 5 秒字串，spec / 測試 / 實作可能失配]** → 以常數、delta spec 與 countdown 測試一起更新來降低遺漏風險。
- **[每秒 toast 更新次數翻倍]** → 維持既有每秒提示模型，不改變通知機制，只接受較長 countdown 帶來的更多更新次數。

## Migration Plan

1. 將 countdown 常數從 5 秒調整為 10 秒。
2. 更新 `prompt-injection-countdown` delta spec，將所有受影響 requirement 與 scenario 改為 10 秒語意。
3. 更新 loop-core countdown 測試與任何明確驗證 5→4→3→2→1 的案例為 10 秒版本。
4. 執行相關測試，確認倒數等待、toast 顯示與取消流程仍正確。

## Open Questions

- 無；本次需求已明確指定 countdown 改為 10 秒。
