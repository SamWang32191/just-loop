# Rename builtin command to `just-loop`

## Summary

將提供給使用者的主 command 從 `ralph-loop` 改為 `just-loop`。本次只處理主 command 的對外名稱與其對應測試，不調整取消 command、內部模組命名或較大範圍的文件同步。

## Goals

- 將使用者可輸入的主 command 改為 `/just-loop`
- 保持既有 command 行為、flag 語意與 loop 流程不變
- 只做最小必要修改，降低 rename 風險

## Non-Goals

- 不修改 `/cancel-ralph`
- 不重命名 `parse-ralph-loop-command.ts`、型別名稱或 `src/ralph-loop/` 目錄
- 不全面更新所有歷史文件中的 `ralph-loop` 字樣
- 不改動 loop state、plugin runtime API、或 completion promise 機制

## Current State

目前使用者可見主 command 名稱主要由以下位置決定：

- `src/plugin/command-definitions.ts`：註冊 builtin command `ralph-loop`
- `src/commands/parse-ralph-loop-command.ts`：只接受 `/ralph-loop` 起始輸入
- `tests/commands/parse-ralph-loop-command.test.ts`：驗證 parser 對 `/ralph-loop` 的解析
- `tests/plugin/plugin-integration.test.ts`：驗證 config 中註冊 `ralph-loop` command

目前 `cancel-ralph` 為獨立 command，不依賴主 command 名稱變更。

## Constraints

- 使用者要求只改主 command，取消 command 必須維持現況
- 變更應限於 command 註冊、輸入解析與必要測試
- 行為應保持向後一致，除了使用者必須改用 `/just-loop` 之外，不應引入額外語意差異

## Approaches Considered

### Approach A — Minimal user-facing rename (recommended)

只將主 command 的對外名稱從 `ralph-loop` 改為 `just-loop`，同步更新 parser 與測試。

**Pros**
- 變更面最小
- 風險最低
- 直接符合使用者需求

**Cons**
- 內部檔名與型別仍保留 `ralph` 命名
- 專案內部命名會暫時存在不完全一致

### Approach B — User-facing rename plus docs sync

在 Approach A 基礎上，一起更新 README 與歷史設計文件中的主 command 字樣。

**Pros**
- 對外敘述更一致

**Cons**
- 變更面大於本次需求
- 容易引入與功能無關的文件 diff

### Approach C — Full internal rename

除對外 command 外，也一起改 parser 檔名、型別名稱與相關內部識別字。

**Pros**
- 長期命名最一致

**Cons**
- 風險與修改量最高
- 不符合本次最小變更需求

## Recommended Design

採用 **Approach A**。

### Scope of Changes

1. 將 builtin command 註冊名稱由 `ralph-loop` 改為 `just-loop`
2. 將 parser 可接受的主 command 前綴由 `/ralph-loop` 改為 `/just-loop`
3. 更新 parser 與 plugin integration 測試中的期待值

### Files Expected to Change

- `src/plugin/command-definitions.ts`
- `src/commands/parse-ralph-loop-command.ts`
- `tests/commands/parse-ralph-loop-command.test.ts`
- `tests/plugin/plugin-integration.test.ts`

### Files Expected Not to Change

- `src/ralph-loop/**`
- `tests/**` 中與主 command rename 無關的檔案
- `README.md`
- `docs/**`

除非實作時發現有額外測試或檢查直接依賴舊 command 名稱，否則不擴大變更範圍。

## Data / Behavior Impact

- 無資料格式變更
- 無 loop 執行邏輯變更
- 無 flag 規則變更
- 唯一預期的使用者可見差異是主 command 由 `/ralph-loop` 改為 `/just-loop`

## Error Handling

- parser 必須對舊 lookalike command 維持嚴格比對，避免 `/just-loopx` 被誤判為合法 command
- 若測試中仍有舊 key `ralph-loop`，應明確更新為 `just-loop`，避免 config 註冊與 parser 行為不一致
- 若有額外整合點依賴舊字串，應限縮在必要修正，不進行額外重構

## Testing / Verification

完成後至少執行：

1. `lsp_diagnostics` 檢查受影響檔案
2. 相關單元/整合測試，至少包含：
   - `tests/commands/parse-ralph-loop-command.test.ts`
   - `tests/plugin/plugin-integration.test.ts`
3. 若專案已有穩定的對應 test script，可用該 script 再跑一次相關驗證

## Success Criteria

- `/just-loop` 能被 parser 正確辨識
- config 中註冊的是 `just-loop` 而非 `ralph-loop`
- 相關測試反映新 command 名稱並通過
- `/cancel-ralph` 維持原狀

## Risks

- repo 內仍會保留 `ralph` 命名的內部檔名與型別，短期內可能造成命名不完全一致
- 若有未覆蓋到的整合點直接比對舊 command 名稱，可能需要補一個最小修正

## Implementation Notes for Planning

- 優先更新 command 定義與 parser，再同步修正測試
- 不進行檔名 rename，避免放大 diff
- 本次不建立 git commit，除非使用者明確要求
