# npm Publish Readiness for `just-loop`

## Summary

讓 `just-loop` 從目前僅供本地開發使用的狀態，提升為可安全手動發佈到 npmjs 的單一 library package。第一版只支援透過 `import` 使用，不包含 CLI 入口，也不納入 CI、自動版號或自動發版流程。最終對外發佈名稱定案為 `@w32191/just-loop`。

## Goals

- 讓 `just-loop` 能進行公開 npm 發佈
- 確保發佈內容包含可執行的 build 產物與型別定義
- 補齊對外必要文件：README 與 MIT LICENSE
- 建立最小但可靠的發佈前檢查流程
- 保持現有 library API 匯入方式不被無關重構影響

## Non-Goals

- 不新增 CLI `bin` 入口
- 不導入 GitHub Actions、Changesets、semantic-release 或其他自動化發版工具
- 不擴充套件功能或重構 runtime 架構
- 不改變既有對外 API，除非為了正確發佈 metadata 必要微調

## Current State

目前專案已具備 TypeScript build 輸出與基本匯入入口，但還不具備 npm 發佈最低條件：

- `package.json` 目前有 `private: true`，會直接阻止 `npm publish`
- 缺少 `version`
- 未在 top-level 明確宣告 `types`
- 沒有 `files` 或 `.npmignore` 控制發佈內容
- repo 根目錄缺少 `README.md` 與 `LICENSE`
- 沒有明確的 publish 前驗證命令與 tarball smoke test 流程

## Constraints

- 套件型態固定為單一 library package，不做 monorepo 規劃
- 產物來源以既有 `tsc -p tsconfig.json` 輸出的 `dist/` 為主
- 發佈流程以手動為主，因此設計必須清楚、低依賴、可由本機直接執行
- `README` 與 `LICENSE` 必須納入第一次發佈準備，其中 license 為 MIT
- Node 相容性基準定為 **Node 20+**

## Approaches Considered

### Approach A — Minimum complete manual publish flow (recommended)

補齊 package metadata、README、MIT LICENSE、publish file selection，以及本機發佈前檢查腳本，保留手動版號與手動 publish。

**Pros**
- 成本最低，能最快達到可發佈狀態
- 與目前專案成熟度相符
- 風險集中在 metadata 與文件，驗證面單純

**Cons**
- 版本管理仍仰賴手動操作
- 發版紀律需要依賴 checklist 與命令規範

### Approach B — Manual publish plus release helper scripts

在 Approach A 基礎上，再加上版本 bump 與發版 helper scripts。

**Pros**
- 比純手動更一致
- 可降低漏步驟機率

**Cons**
- 會增加本次規劃與實作範圍
- 對第一次發版不是必要條件

### Approach C — Full automated release pipeline

直接導入 CI、tag-based release 與自動 publish。

**Pros**
- 長期最省手動成本

**Cons**
- 當前過重
- 在套件尚未完成第一次手動發版前，會放大設定與除錯成本

## Recommended Design

採用 **Approach A**。

### Runtime Compatibility

第一版公開發佈的 runtime / tooling baseline 定為 **Node 20+**。

- `package.json.engines.node` 應與此一致
- README 應明示最低支援 Node 版本
- `smoke:pack` 與其他驗證命令均以 Node 20+ 為執行基準

### 1. Package Metadata

根目錄 `package.json` 應調整為正式可發佈套件設定：

- 移除 `private: true`
- 新增 `version`（第一版建議 `0.1.0` 或 `0.0.1`，實際值由實作時決定）
- 將 `name` 定案為 `"@w32191/just-loop"`
- 保留 `type: "module"`
- 新增 `license: "MIT"`
- 新增 `publishConfig.access: "public"`
- 補上 top-level `types`，指向 `./dist/src/index.d.ts`
- 保留 `main` 與 `exports` 指向 `dist/src/index.js`
- 不新增 `bin`
- `description` 屬於本次範圍，應補最小可讀描述
- `repository`、`bugs`、`homepage` 明確延後，不列入第一次可發佈條件

這樣可讓 npm registry metadata 明確反映 library 使用方式，也避免僅靠 `exports.types` 被部分工具忽略。

### 1.1 Dependency Policy

`@opencode-ai/plugin` 目前在原始碼中主要作為型別用途，但依賴分類不能只看編譯後 JS；也必須檢查公開 `.d.ts` surface 是否仍引用該套件。

- 若編譯後 JS 仍實際 import 該套件，保留在 `dependencies`
- 若編譯後 JS 不再 import，但公開 `.d.ts` 仍引用其型別，第一版保守保留在 `dependencies`，避免 TypeScript 消費者安裝後型別解析失敗
- 只有在 emitted JS 與公開 `.d.ts` 都不再依賴該套件時，才可移到 `devDependencies`

此規則可同時兼顧 runtime 與型別消費者，不會為了減少依賴而破壞 `.d.ts` 可解析性。

### 2. Publish File Selection

應使用 `package.json` 的 `files` 白名單控制發佈內容，而不是依賴 `.npmignore`。

建議納入：

- `dist/`
- `README.md`
- `LICENSE`

白名單方式能避免將規劃文件、開發設定與本地工作檔誤發到 npm，也能避免 `dist/` 因 `.gitignore` 存在而在認知上混淆。實作時以 `npm pack` 作為唯一 tarball 驗證入口。

### 3. Documentation Surface

新增根目錄 `README.md`，至少包含：

- 套件用途簡述
- 安裝指令
- 目標 host / 使用情境（OpenCode plugin）
- 實際匯入形式：`default import`
- 最小可運作範例，形如 `import plugin from "@w32191/just-loop"`
- 說明 Bun 是發版/維護前置條件，不是一般安裝者的必要條件
- 版本與發佈維護說明的最小段落

新增根目錄 `LICENSE`，內容為 MIT。

文件不是附加品，而是第一版公開發佈的基本介面；缺少 README 會直接影響 npm 頁面可讀性，缺少 license 會降低可採用性。

### 4. Publish Verification Flow

為了降低手動發佈失誤，應定義固定順序的本機驗證：

1. `npm login`
2. `npm whoami`
3. 確認目前帳號具備 `@w32191` scope 的發佈權限，且 `@w32191/just-loop` 名稱可用
4. 確認發版機器具備 Node.js、npm，且若沿用現有 `test` script，需已安裝 Bun
5. `npm run build`
6. `npm run test`
7. `npm pack`
8. 在臨時 consumer 目錄安裝產生的 tarball
9. 以 Node ESM 方式執行 `import plugin from "@w32191/just-loop"`，確認可成功載入 default export
10. 在同一個臨時 consumer 執行 `tsc --noEmit`，確認公開型別可解析

為避免手動流程、README 與 publish gate 漂移，第一版應將驗證集中成單一 canonical script 鏈：

- `smoke:pack`：在臨時 consumer 目錄安裝 `npm pack` 產生的 tarball，並完成兩類驗證：
  - 以 Node ESM 方式驗證 `default import`（例如使用 `node --input-type=module` 或 consumer 專案設 `"type": "module"`）
  - 在同一個臨時 TypeScript consumer 執行 `tsc --noEmit`，確認 `types` 與其外部型別依賴可解析
- 臨時 consumer 規格固定為：
  - `package.json` 設 `"type": "module"`
  - `tsconfig.json` 使用 `module: "NodeNext"`、`moduleResolution: "NodeNext"`
  - 由 `smoke:pack` 腳本自行建立 fixture 檔案
  - 使用 root `node_modules/.bin/tsc -p <temp>/tsconfig.json --noEmit` 執行驗證
- `verify:publish`：依序執行 `npm run build` → `npm run test` → `npm pack` → `npm run smoke:pack`
- `verify:publish` 不可硬編碼 tarball 名稱；應透過 `npm pack --json` 取得本次產生的實際 tarball 路徑，再傳給 `smoke:pack`

第一版應明確新增 `prepublishOnly`，將正式 `npm publish` 前的強制 gate 固定為：

1. `npm run verify:publish`

若保留現有 `test` 依賴 `bun run build && bun test` 的行為，則「發版機器需安裝 Bun」屬於明確前置條件，而非僅列為風險。

### 5. Manual Publish Procedure

第一版手動發佈流程應文件化為：

1. `npm login`
2. `npm whoami`
3. 確認目前帳號具備 `@w32191` scope 的發佈權限，且 `@w32191/just-loop` 名稱可用
4. 確認 `package.json` 版本號
5. 執行 `npm run verify:publish`
6. 首次公開發佈使用 `npm publish --access public`

由於發佈名稱已定案為 scoped package，本次不再保留名稱 fallback 分支。

## Files Expected to Change

- `package.json`
- `README.md` (new)
- `LICENSE` (new)
- 發佈相關 npm scripts（於 `package.json` 內）
- smoke test helper script（new）

## Files Expected Not to Change

- `src/**`（除非後續驗證發現匯出入口有 metadata 不一致問題）
- `tests/**`（除非需要補發佈相關 smoke test）
- `.opencode/**`
- `openspec/**`

## Data / Behavior Impact

- 對 library runtime 行為預期無直接變更
- 主要影響 package metadata、npm tarball 內容與對外文件表面
- 若新增 `prepublishOnly`，只會影響 publish 前驗證，不影響消費者 runtime

## Error Handling

- 若 `npm pack` 產生的 tarball 未包含 `dist/`，優先檢查 `files` 設定
- 若 scoped package 首次公開發佈失敗，優先檢查是否缺少 `--access public` 或 npm 帳號是否具備對應 scope 權限
- 若 `npm run test` 綁定 Bun 執行環境，發版機器必須具備 Bun；第一版先接受此前置條件，不在本次擴充為純 npm 測試鏈

## Testing / Verification

完成實作後至少應驗證：

1. `package.json` 不再有 `private: true`，且含合法 `version`
2. `npm run build` 成功
3. `npm run test` 成功
4. `npm pack` 成功並產出 tarball
5. tarball 內容包含 `dist/`、`README.md`、`LICENSE`，且不含不必要開發檔案
6. 在臨時空目錄中可透過 tarball 安裝，並以 Node ESM 成功執行 `import plugin from "@w32191/just-loop"`
7. 在臨時 TypeScript consumer 中可成功 `tsc --noEmit`，且 `default import` 與公開型別可被解析
8. `@opencode-ai/plugin` 已依 emitted JS 與公開 `.d.ts` 的實際使用情況正確分類
9. `prepublishOnly` 已收斂為呼叫 `npm run verify:publish`
10. `package.json` 已包含 `publishConfig.access: "public"`
11. `package.json` 已包含與設計一致的 `engines.node`

## Success Criteria

- `just-loop` 具備 npm publish 所需的最小 metadata
- 發佈包內容可預期且包含必要 build 產物
- npm 頁面必要文件齊全（README、MIT LICENSE）
- 有清楚可重複執行的手動發佈前檢查流程
- 後續只需填入實際版本並執行 publish，即可進行第一次公開發佈

## Risks

- `@w32191/just-loop` 需確認 npm scope 與名稱可用性
- 現有 `test` 腳本依賴 Bun，可能使發版環境要求高於純 npm 使用者預期
- 若 `README` 未精準描述 API，第一次公開發佈的可用性會受影響

## Implementation Notes for Planning

- 優先處理 `package.json` metadata 與 publish file selection
- 早期先檢查 `@opencode-ai/plugin` 是否出現在 emitted JS 與公開 `.d.ts`，再決定依賴分類
- 再補 README 與 MIT LICENSE
- 最後補 `smoke:pack`、`verify:publish` 與手動發佈文件化步驟
- 本次工作不自動建立 git commit，除非使用者明確要求
