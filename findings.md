# Findings & Decisions

## Requirements
- 使用者要先完成「可以發佈到 npmjs」的規劃，不是立刻實作。
- 規劃需能銜接後續實作。

## Research Findings
- 專案是單一 package，不是 monorepo。
- `package.json` 目前有 `name`, `private`, `type`, `main`, `exports`, `scripts`。
- `private: true` 會直接阻止 `npm publish`。
- 缺少 `version`，這是 npm 發佈必要欄位。
- 目前已有 `dist/src/index.js` 與 `dist/src/index.d.ts` 輸出跡象。
- 沒有 `README`、`LICENSE`、`.npmignore`。
- `package.json` 沒有 `files`，而 `.gitignore` 忽略 `dist/`，有機會導致 publish 內容不完整。
- 沒有 `prepublishOnly` / `prepare` / `release` 類 scripts。
- 沒有明顯 CI / release workflow。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 先盤點 publish blockers 再規劃方案 | 現況已有明確缺口，可據此設計 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| planning-with-files 腳本無執行權限 | 手動建立規劃檔與紀錄 |

## Resources
- `/Users/samwang/tmp/workspace/just-loop/package.json`
- `/Users/samwang/tmp/workspace/just-loop/task_plan.md`
- `/Users/samwang/tmp/workspace/just-loop/findings.md`
- `/Users/samwang/tmp/workspace/just-loop/progress.md`

## Visual/Browser Findings
- 無

---
*Update this file after every 2 view/browser/search operations*
