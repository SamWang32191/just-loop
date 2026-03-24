# npm Publish Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `just-loop` 以 `@w32191/just-loop` 名稱具備可安全手動發佈到 npmjs 的條件，包含正確 metadata、README、MIT LICENSE、tarball smoke test 與 publish gate。

**Architecture:** 保持現有 ESM library 輸出與 public API 不變，只調整 package surface。驗證鏈集中在 `package.json` scripts 與兩個專用 helpers：`scripts/verify-publish.mjs` 先執行 `npm pack --json` 並取得本次 tarball 路徑，接著呼叫 `scripts/smoke-pack.mjs` 在臨時 consumer 驗證 runtime import 與 TypeScript types。

**Tech Stack:** TypeScript、Node 20+、npm、Bun、`@opencode-ai/plugin`

---

## Planned File Structure

### Create
- `README.md` — npm 頁面對外說明、安裝與最小使用範例
- `LICENSE` — MIT 授權文字
- `scripts/verify-publish.mjs` — 執行 `npm pack --json` 並將 tarball 路徑交給 smoke helper
- `scripts/smoke-pack.mjs` — 安裝 tarball 到臨時 consumer 並驗證 ESM import + TypeScript 型別
- `tests/publish/package-metadata.test.ts` — 驗證 `package.json` 發佈 metadata 與 scripts

### Modify
- `package.json` — 發佈 metadata、scripts、可能的 dependency 分類

### Verify-only
- `dist/src/index.d.ts` / `dist/src/index.js` — build 後檢查 dependency policy 與輸出介面
- `src/index.ts` — 確認 default export 介面未變
- `tests/**` — 除新增 publish metadata test 外，其餘現有測試不應被改壞

---

### Task 1: 鎖定 package metadata 與 dependency policy

**Files:**
- Modify: `package.json`
- Test: `tests/publish/package-metadata.test.ts`
- Verify: `src/index.ts`

- [ ] **Step 1: 寫失敗測試，定義目標 metadata 與 scripts**

```ts
import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"

async function readPackageJson() {
  return JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"))
}

describe("publish metadata", () => {
  it("uses scoped public package metadata", async () => {
    const pkg = await readPackageJson()
    expect(pkg.name).toBe("@w32191/just-loop")
    expect(pkg.private).toBeUndefined()
    expect(pkg.bin).toBeUndefined()
    expect(pkg.version).toBeDefined()
    expect(pkg.description).toBeDefined()
    expect(pkg.type).toBe("module")
    expect(pkg.license).toBe("MIT")
    expect(pkg.main).toBe("./dist/src/index.js")
    expect(pkg.types).toBe("./dist/src/index.d.ts")
    expect(pkg.exports?.["."]?.import).toBe("./dist/src/index.js")
    expect(pkg.exports?.["."]?.types).toBe("./dist/src/index.d.ts")
    expect(pkg.publishConfig).toEqual({ access: "public" })
    expect(pkg.engines?.node).toBe(">=20")
  })

  it("publishes only required files", async () => {
    const pkg = await readPackageJson()
    expect(pkg.files).toEqual(["dist/", "README.md", "LICENSE"])
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/publish/package-metadata.test.ts`
Expected: FAIL，因為 `package.json` 尚未符合發佈規格

- [ ] **Step 3: 更新 `package.json` 到可發佈基線**

```json
{
  "name": "@w32191/just-loop",
  "version": "0.1.0",
  "description": "OpenCode plugin package for just-loop.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "import": "./dist/src/index.js"
    }
  },
  "files": ["dist/", "README.md", "LICENSE"],
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 4: 先 build，再檢查 dependency policy**

Run: `npm run build`
Expected: 成功產出 `dist/src/index.js` 與 `dist/src/index.d.ts`

Run: 檢查 `dist/**/*.js` 與 `dist/**/*.d.ts`
Expected: 判斷 `@opencode-ai/plugin` 是否仍出現在任何公開可達的 emitted JS 或 `.d.ts` surface

Decision rule:
- 若任何公開可達的 `dist/**/*.js` 或 `dist/**/*.d.ts` 仍引用 `@opencode-ai/plugin`，保留在 `dependencies`
- 只有 emitted JS 與公開 `.d.ts` surface 都不再引用，且 tarball TypeScript smoke test 仍通過時，才可移到 `devDependencies`

- [ ] **Step 5: 跑測試確認通過**

Run: `bun test tests/publish/package-metadata.test.ts`
Expected: PASS

---

### Task 2: 補齊 README 與 MIT LICENSE

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Verify: `src/index.ts`

- [ ] **Step 1: 先確認實際 public import 形式**

Read: `src/index.ts`
Expected: 確認套件對外是 `default export`

- [ ] **Step 2: 撰寫 README 草稿**

```md
# @w32191/just-loop

OpenCode plugin package for just-loop.

## Requirements

- Node 20+

## Install

```bash
npm install @w32191/just-loop
```

## Usage

```ts
import plugin from "@w32191/just-loop"

const opencodePlugin = plugin
void opencodePlugin
```

This package is intended for OpenCode plugin usage.

## Maintainers

Publishing verification uses Bun during maintenance/release workflows, but Bun is not a required runtime dependency for package consumers.

## Release

1. Confirm Node 20+, npm, and Bun are installed.
2. Confirm npm login and `@w32191` scope access.
3. Update package version.
4. Run `npm run verify:publish`.
5. Publish with `npm publish --access public`.
```

- [ ] **Step 3: 新增 MIT LICENSE**

使用標準 MIT 文字，copyright holder 定案為 `Sam Wang`。

- [ ] **Step 4: 人工檢查 README 是否與真實 API 一致**

Checklist:
- 安裝名稱是 `@w32191/just-loop`
- 範例是 `default import`
- 有 Node 20+
- 有 OpenCode plugin 使用情境
- 有 Bun 僅為維護前置條件的說明

---

### Task 3: 建立 tarball smoke test helper

**Files:**
- Create: `scripts/verify-publish.mjs`
- Create: `scripts/smoke-pack.mjs`
- Modify: `package.json`

- [ ] **Step 1: 先寫 helper 設計目標**

`smoke-pack.mjs` 必須：
- 接收 tarball 路徑參數
- 建立臨時 consumer 目錄
- 寫入臨時 `package.json`（`type: module`）
- 寫入臨時 `tsconfig.json`（`module/moduleResolution: NodeNext`）
- 安裝 tarball
- 用 Node ESM 驗證 `import plugin from "@w32191/just-loop"`
- 用 root `node_modules/.bin/tsc -p <temp>/tsconfig.json --noEmit` 驗證 types

- [ ] **Step 2: 寫出 helper 最小版本**

```js
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"

const tarballPath = process.argv[2]
if (!tarballPath) throw new Error("tarball path is required")

const root = process.cwd()
const tempDir = await mkdtemp(join(tmpdir(), "just-loop-pack-"))

try {
  await writeFile(join(tempDir, "package.json"), JSON.stringify({
    name: "pack-smoke-consumer",
    private: true,
    type: "module"
  }, null, 2))

  await writeFile(join(tempDir, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      noEmit: true
    },
    include: ["index.ts"]
  }, null, 2))

  await writeFile(join(tempDir, "index.ts"), 'import plugin from "@w32191/just-loop"\nvoid plugin\n')
  await writeFile(join(tempDir, "runtime-check.mjs"), 'import plugin from "@w32191/just-loop"\nif (plugin === undefined) throw new Error("default export missing")\n')

  // npm install <tarball>
  // node runtime-check.mjs
  // <root>/node_modules/.bin/tsc -p <temp>/tsconfig.json --noEmit
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
```

- [ ] **Step 3: 讓 helper 對失敗命令直接 non-zero exit**

Run commands in order:
1. `npm install <tarball>` in temp dir
2. `node runtime-check.mjs`
3. `<root>/node_modules/.bin/tsc -p <temp>/tsconfig.json --noEmit`

Expected: 任一步失敗都讓 script exit 1

- [ ] **Step 4: Commit**

不要 commit；除非使用者明確要求。

---

### Task 4: 收斂 verify:publish / prepublishOnly 腳本

**Files:**
- Modify: `package.json`
- Create: `scripts/verify-publish.mjs`
- Verify: `scripts/smoke-pack.mjs`

- [ ] **Step 1: 新增 canonical scripts**

`package.json` scripts 應至少包含：

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "bun run build && bun test",
    "smoke:pack": "node scripts/smoke-pack.mjs",
    "verify:publish": "npm run build && npm run test && node scripts/verify-publish.mjs",
    "prepublishOnly": "npm run verify:publish"
  }
}
```

- [ ] **Step 2: 實作 `scripts/verify-publish.mjs`**

`verify-publish.mjs` 必須：
- 執行 `npm pack --json`
- 解析 JSON 取出本次 tarball `filename`
- 以 repo root `resolve()` 將 tarball 檔名轉成絕對路徑
- 以 `npm run smoke:pack -- <tarball>` 交棒給 `smoke:pack`
- 任一步失敗都 non-zero exit
- 同時讀取 `npm pack --json` 回傳的 `files` 欄位，對 tarball 內容做白名單/黑名單比對

Canonical flow:
- `npm run verify:publish`
  - `npm run build`
  - `npm run test`
  - `node scripts/verify-publish.mjs`
    - `npm pack --json`
    - 驗證 `files` 白名單/黑名單
    - `npm run smoke:pack -- <tarball>`

- [ ] **Step 3: 將 tarball handoff 固定為 `npm pack --json`**

Expected behavior:
- 不硬編碼 `.tgz` 檔名
- 支援 scoped package 檔名變動
- `smoke:pack` 的輸入一律來自本次剛產生的 tarball
- 傳給 `smoke:pack` 的 tarball 必須是以 repo root `resolve()` 後的絕對路徑
- `verify-publish.mjs` 使用 `npm pack --json` 的 `files` 欄位做固定比對：
  - 必須存在：`README.md`, `LICENSE`, `dist/src/index.js`, `dist/src/index.d.ts`
  - 不得存在以前綴比對命中的路徑：`docs/`, `tests/`, `src/`
  - 不得存在明確檔名：`task_plan.md`, `findings.md`, `progress.md`

- [ ] **Step 4: 手動跑完整驗證鏈**

Run: `npm run verify:publish`
Expected:
- build 成功
- test 成功
- `npm pack --json` 成功
- smoke helper 成功通過 runtime + type checks

- [ ] **Step 5: 確認 `prepublishOnly` 只呼叫 `npm run verify:publish`**

Read: `package.json`
Expected: `prepublishOnly` 沒有分岔邏輯

- [ ] **Step 6: 擴充 scripts 驗證測試**

在 Task 1 的 metadata test 之外新增 assertions（可沿用同一測試檔）：
- `scripts["smoke:pack"]` 存在
- `scripts["verify:publish"] === "npm run build && npm run test && node scripts/verify-publish.mjs"`
- `scripts["prepublishOnly"] === "npm run verify:publish"`

---

### Task 5: 補齊 preflight 與發佈前人工驗證

**Files:**
- Modify: `README.md`（若驗證後需要修文）
- Verify: `package.json`, `dist/**`, generated tarball

- [ ] **Step 1: 先做 preflight 檢查**

Run: `node -v && npm -v && bun -v`
Expected: 可看到 Node 20+、npm、Bun 版本

Run: `npm whoami`
Expected: 回傳目前登入帳號

Manual check:
- 帳號具備 `@w32191` scope 權限
- `@w32191/just-loop` 名稱可用

Suggested commands / checks:
- `npm access ls-packages @w32191` 或等效 npm scope 權限查詢
- `npm view @w32191/just-loop version`

Pass criteria:
- 權限查詢未顯示 scope access 問題
- `npm view @w32191/just-loop version` 若回傳 not found / 404，視為名稱可用；若回傳版本，表示名稱已存在，需先停下

- [ ] **Step 2: 跑 metadata 測試**

Run: `bun test tests/publish/package-metadata.test.ts`
Expected: PASS

- [ ] **Step 3: 跑完整 publish 驗證鏈**

Run: `npm run verify:publish`
Expected: PASS

- [ ] **Step 4: 檢查 tarball 內容**

Run: `npm pack --json`
Expected: output JSON 含本次 tarball 檔名

Checklist:
- 包含 `dist/src/index.js`
- 包含 `dist/src/index.d.ts`
- 包含 `README.md`
- 包含 `LICENSE`
- 不含 `docs/`, `tests/`, `src/`, `task_plan.md`, `findings.md`, `progress.md`

- [ ] **Step 5: 確認手動公開發佈指令**

Runbook:
1. `npm login`
2. `npm whoami`
3. 確認具備 `@w32191` scope 權限
4. `npm view @w32191/just-loop version`，確認第一次發佈預期（若已有版本則先停下）
5. bump `version`
6. `npm run verify:publish`
7. `npm publish --access public`

---

## Final Verification

- [ ] Run: `bun test tests/publish/package-metadata.test.ts`
- [ ] Expected: PASS
- [ ] Run: `npm run build`
- [ ] Expected: `dist/src/index.js` 與 `dist/src/index.d.ts` 存在
- [ ] Run: `npm run test`
- [ ] Expected: PASS
- [ ] Run: `npm run verify:publish`
- [ ] Expected: PASS
- [ ] Run: `npm pack --json`
- [ ] Expected: tarball 僅含允許發佈檔案

## Required Test Matrix

- [ ] `package.json` metadata：`name`, `version`, `license`, `publishConfig.access`, `engines.node`
- [ ] `package.json` metadata：`description`, top-level `types`, `private` 已移除
- [ ] `package.json` surface：`bin` 不存在
- [ ] `package.json` entrypoints：`main`, `exports["."].import`, `exports["."].types`
- [ ] `package.json` file whitelist：只有 `dist/`, `README.md`, `LICENSE`
- [ ] `prepublishOnly` 只走 `verify:publish`
- [ ] tarball runtime smoke：Node ESM `default import`
- [ ] tarball TypeScript smoke：`tsc --noEmit` 可解析 default export 與公開型別依賴
- [ ] dependency policy：`@opencode-ai/plugin` 的最終分類符合所有公開可達 emitted JS + `.d.ts` 與 tarball smoke 結果
