# Task Plan: Reverse-engineer Ralph Loop and design just-loop

## Goal
理解 `.reference/oh-my-openagent` 中 Ralph Loop 的實作、架構與細節，並提出在 `just-loop` 中實作「只包含 Ralph Loop 功能」插件的設計方向。

## Current Phase
Phase 2

## Phases

### Phase 1: Requirements & Discovery
- [x] 理解使用者目標
- [x] 探索目前 repo 與參考插件結構
- [x] 將初步研究寫入 findings.md
- **Status:** complete

### Phase 2: Design Options
- [x] 界定交付物範圍（研究/設計/是否進入實作）
- [x] 提出 2-3 種落地方案與取捨
- [x] 形成推薦方案
- **Status:** complete

### Phase 3: Design Summary
- [x] 整理 Ralph Loop 最小必要模組
- [x] 定義在 just-loop 的目錄與整合面
- [x] 列出風險與待確認事項
- **Status:** complete

### Phase 4: Documentation & Review
- [x] 將設計寫入文件
- [x] 請使用者確認設計
- [x] 準備進入實作規劃
- **Status:** complete

### Phase 5: Delivery
- [ ] 提供精簡結論與下一步
- **Status:** in_progress

## Key Questions
1. 目標範圍：最小核心 loop（已回答）
2. 落地形式：真正 plugin runtime（已回答）
3. 是否保留 ultrawork/oracle verification 分支：待確認，但目前傾向不納入最小核心

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先做逆向理解與設計，不直接動手實作 | 使用者先要求理解參考插件，再評估如何在本 repo 落地 |
| 使用 `.reference/oh-my-openagent` 作為唯一參考來源 | 使用者明確指出它是參考 plugin |
| 設計目標為「最小核心 loop」而非完整參考插件複刻 | 使用者已明確選擇最小核心 loop |
| 規劃成真正 plugin runtime，而不是只做 command/skill workflow | 使用者已明確選擇正式 plugin 架構 |
| 採用方案 A：薄殼 plugin + 移植 Ralph Loop 核心 | 最符合最小核心 loop + 正式 plugin runtime 目標 |
| state-store 路徑使用 `.loop/ralph-loop.local.md` | 使用者明確指定本專案的狀態檔位置 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 無前次 lessons 可回收 | 1 | `docs/lessons/` 不存在，略過 recall |

## Notes
- 目前 repo 偏向 OpenCode/OpenSpec 指令骨架，尚無一般 `src/` runtime。
- Ralph Loop 參考實作高度依賴 session hooks、session client 與 builtin commands。
