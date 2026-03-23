# Rename project to `just-loop`

## Summary

將專案名稱統一改為 `just-loop`，涵蓋套件名稱、lockfile 內 workspace 名稱、repo 內文件文字，以及專案根目錄名稱。此變更僅處理命名一致性，不擴大到功能、模組結構或 Ralph Loop 行為調整。

## Goals

- 將對外主要專案名稱統一為 `just-loop`
- 移除 repo 內已知的舊專案名稱殘留字串
- 保持現有程式行為、測試與建置結果不變
- 在 rename 後仍可正常於新目錄路徑下開發與執行驗證

## Non-Goals

- 不更動 Ralph Loop 功能、流程或 state path
- 不重新命名 `src/ralph-loop/` 等既有功能模組
- 不變更 slash commands、plugin runtime API、或任何使用者功能名稱
- 不處理遠端 GitHub repo 名稱、npm 發佈流程、或外部 CI 設定（除非 repo 內明確有相關字串）

## Current State

目前舊專案名稱字串主要出現在下列位置：

- `package.json` 的 `name`
- `bun.lock` 的 workspace 名稱
- repo 內若干規劃/設計/lesson 文件
- 本機工作目錄名稱（rename 前的舊路徑）

目前未在 `src/` 與 `tests/` 內發現舊專案名稱命中，因此 rename 預期不需要碰觸執行邏輯。

## Constraints

- Ralph Loop persisted state path 必須維持 `.loop/ralph-loop.local.md`
- 變更應聚焦於命名一致性，不引入任何功能性重構
- 目錄 rename 會改變工作路徑，後續驗證與操作必須改在新路徑進行

## Approaches Considered

### Approach A — Full rename in one pass (recommended)

一次完成 package 名稱、lockfile、文件、與專案根目錄 rename。

**Pros**
- 一次完成，名稱狀態最一致
- 不會留下 repo 內外名稱不一致的過渡狀態

**Cons**
- 工作目錄路徑會變，操作時需小心切換
- 若有外部腳本依賴舊路徑，需由使用者自行同步

### Approach B — Rename repo contents first, rename directory later

先處理 package 與文件，資料夾名稱另一步手動處理。

**Pros**
- 執行風險較低
- 便於分段檢查

**Cons**
- 會暫時保留名稱不一致狀態
- 容易漏掉後續目錄 rename

### Approach C — Package-only rename

只改 package 與 lockfile，其他文字維持不動。

**Pros**
- 最快

**Cons**
- 文件與目錄名仍殘留舊名
- 不符合使用者要的完整 rename 範圍

## Recommended Design

採用 **Approach A**。

### Scope of Changes

1. 將 `package.json` 中的 package name 改為 `just-loop`
2. 將 `bun.lock` 中對應 workspace 名稱改為 `just-loop`
3. 將 repo 內文件中所有舊專案名稱文字改為 `just-loop`
4. 將專案根目錄改名為 `just-loop`

### Files Expected to Change

- `package.json`
- `bun.lock`
- `findings.md`
- `task_plan.md`
- `progress.md`
- `docs/superpowers/plans/2026-03-23-ralph-loop-implementation.md`
- `docs/superpowers/specs/2026-03-23-ralph-loop-design.md`
- `docs/lessons/ralph-loop-state-store-path.md`
- this rename design spec file

### Files Expected Not to Change

- `src/**`
- `tests/**`
- `openspec/config.yaml`

除非實際檢查發現這些檔案內仍有舊名字串，否則不做無關修改。

## Data / Behavior Impact

- 無資料格式變更
- 無 runtime 行為變更
- 無測試語意變更
- 只有 package metadata、文件文字與本機路徑變更

## Error Handling

- 若目錄 rename 成功後舊路徑失效，後續所有指令必須改在新路徑執行
- 若 `bun.lock` 因 package 名稱變更需重建，應以最小必要變更為原則，避免無關 lockfile 漂移
- 若發現額外舊專案名稱殘留，應在完成前再做一次全 repo 搜尋並補齊

## Testing / Verification

完成 rename 後至少執行：

1. 全 repo 搜尋舊專案名稱字串，預期為 0 命中
2. 全 repo 搜尋 `just-loop`，確認新名稱已落到預期位置
3. `bun run typecheck`
4. `bun run build`
5. 若現有測試集可穩定執行，則執行 `bun test`

## Success Criteria

- repo 內不再有舊專案名稱殘留字串（如非歷史 Git 物件）
- `package.json` 與 `bun.lock` 反映新名稱 `just-loop`
- 文件內專案名稱一致
- 專案可在新目錄 `just-loop` 下完成 typecheck/build，最好也能通過測試

## Spec Inclusion Rule

本 design spec 本身也屬於 rename 範圍，因此其內文不應再保留舊專案名稱字串；應一併更新為不含舊名的描述或直接使用 `just-loop`。本檔案檔名不需再因 rename 額外調整；僅需更新內容文字。

## Risks

- 本機若有外部 shell alias、腳本或 editor workspace 綁定舊路徑，rename 後需同步更新
- 若 lockfile 因工具版本行為出現非必要重排，diff 可能比預期大
- 歷史文件會改寫專案名稱，雖然符合一致性目標，但會弱化原始設計過程的歷史表述

## Implementation Notes for Planning

- 先修改 repo 內檔案，再處理根目錄 rename，避免編輯過程中工具仍指向舊路徑
- 目錄 rename 後，所有驗證命令需切換到新路徑執行
- 本次工作不應自動建立 git commit，除非使用者明確要求
