# Ralph Loop Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個正式的 `my-loop-plugin` TypeScript plugin runtime，提供最小核心 Ralph Loop：`/ralph-loop`、`/cancel-ralph`、單一 active loop state、completion 偵測、continuation 注入、`.loop/ralph-loop.local.md` 持久化。

**Architecture:** 以薄殼 plugin + 核心 loop engine 實作。`src/plugin/` 專責 OpenCode hook glue，`src/ralph-loop/` 專責 loop state、completion、continuation 與 event 決策，所有宿主 API 透過 `src/host-adapter/` 收斂。第一版固定 `continue-only`，不實作 ultrawork 與 reset strategy。

**Tech Stack:** TypeScript、Bun、`@opencode-ai/plugin`、Bun test

---

## Host Contract Anchors

實作時一律以目前 repo 已安裝的型別為準，不靠猜測：

- `@opencode-ai/plugin/dist/index.d.ts`
  - `Hooks["chat.message"]`
  - `Hooks.event`
- `@opencode-ai/sdk/dist/gen/types.gen.d.ts`
  - `Part`, `TextPart`
  - `SessionMessagesResponse` (`Array<{ info: Message; parts: Array<Part> }>`)
  - `EventSessionIdle`, `EventSessionDeleted`, `EventSessionError`
- `@opencode-ai/sdk/dist/gen/sdk.gen.d.ts`
  - `Session.prompt`
  - `Session.promptAsync`

本 plan 定錨如下：
- `chat.message` 文字來源：`output.parts` 中的 `TextPart.text`
- `session.idle` payload：`properties.sessionID`
- `session.deleted` payload：`properties.info.id`
- `session.error` payload：`properties.sessionID`
- `session.messages` 回傳：`Array<{ info, parts }>`，assistant 文字必須由 `info.role === "assistant"` 且 `parts` 中的 `TextPart.text` 抽取
- continuation 注入：**優先用 `promptAsync`**（只需送出下一輪，由 event 驅動後續循環）；若型別或 runtime 不可用，再退回 `prompt`

---

## Planned File Structure

### Create
- `package.json` - root runtime package，定義 `build`、`typecheck`、`test`
- `tsconfig.json` - TypeScript 編譯設定
- `src/index.ts` - plugin entry
- `src/plugin/create-plugin.ts` - plugin shell 組裝
- `src/plugin/chat-message-handler.ts` - `/ralph-loop`、`/cancel-ralph` 入口
- `src/plugin/event-handler.ts` - `session.idle / deleted / error` 轉接
- `src/commands/parse-ralph-loop-command.ts` - 命令解析
- `src/ralph-loop/constants.ts` - 預設常數與 state path
- `src/ralph-loop/types.ts` - state/options 介面
- `src/ralph-loop/state-store.ts` - `.loop/ralph-loop.local.md` 讀寫
- `src/ralph-loop/completion-detector.ts` - completion promise 偵測
- `src/ralph-loop/continuation-prompt.ts` - 下一輪 prompt builder
- `src/ralph-loop/loop-core.ts` - `startLoop / cancelLoop / handleEvent`
- `src/host-adapter/types.ts` - 宿主能力抽象
- `src/host-adapter/opencode-host-adapter.ts` - OpenCode adapter
- `tests/commands/parse-ralph-loop-command.test.ts`
- `tests/ralph-loop/state-store.test.ts`
- `tests/ralph-loop/completion-detector.test.ts`
- `tests/ralph-loop/loop-core.test.ts`
- `tests/plugin/plugin-integration.test.ts`

### Modify
- `.gitignore` - 新增 `.loop/`

---

### Task 1: 建立 runtime 骨架與本地 state hygiene

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/plugin/create-plugin.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 建立 root `package.json`**

```json
{
  "name": "my-loop-plugin",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@opencode-ai/plugin": "1.3.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 建立 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["bun-types"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 更新 `.gitignore` 忽略本地 loop state**

```gitignore
.loop/
```

- [ ] **Step 4: 建立最小 plugin entry 與 shell 組裝檔**

```ts
// src/index.ts
import { createPlugin } from "./plugin/create-plugin"

export default createPlugin
```

```ts
// src/plugin/create-plugin.ts
export function createPlugin() {
  return {
    "chat.message": async () => {},
    event: async () => {},
  }
}
```

- [ ] **Step 5: 跑型別檢查**

Run: `bun run typecheck`
Expected: 成功，沒有 TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore src/index.ts src/plugin/create-plugin.ts
git commit -m "chore: scaffold plugin runtime"
```

---

### Task 2: 先用 TDD 建立 command parser

**Files:**
- Create: `src/commands/parse-ralph-loop-command.ts`
- Test: `tests/commands/parse-ralph-loop-command.test.ts`

- [ ] **Step 1: 寫失敗測試，覆蓋最小命令行為**

```ts
import { describe, expect, it } from "bun:test"
import { parseRalphLoopCommand } from "../../src/commands/parse-ralph-loop-command"

describe("parseRalphLoopCommand", () => {
  it("returns null for non-command text", () => {
    expect(parseRalphLoopCommand("hello world")).toBeNull()
  })

  it("returns null for lookalike commands", () => {
    expect(parseRalphLoopCommand("/ralph-loopx test")).toBeNull()
  })

  it("parses prompt and max iterations", () => {
    expect(parseRalphLoopCommand("/ralph-loop --max 3 build plugin")).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: 3,
      completionPromise: "<promise>DONE</promise>",
    })
  })

  it("parses custom completion promise", () => {
    expect(parseRalphLoopCommand('/ralph-loop --promise "<promise>SHIP</promise>" build plugin')).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: undefined,
      completionPromise: "<promise>SHIP</promise>",
    })
  })

  it("parses cancel command", () => {
    expect(parseRalphLoopCommand("/cancel-ralph")).toEqual({ kind: "cancel" })
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts`
Expected: FAIL，因為 parser 尚未實作

- [ ] **Step 3: 實作最小 parser**

```ts
export function parseRalphLoopCommand(input: string) {
  const trimmed = input.trim()
  const isStartCommand = /^\/ralph-loop(\s|$)/.test(trimmed)
  const isCancelCommand = trimmed === "/cancel-ralph"

  if (!isStartCommand && !isCancelCommand) {
    return null
  }

  if (isCancelCommand) {
    return { kind: "cancel" } as const
  }

  const maxMatch = input.match(/--max\s+(\d+)/)
  const promiseMatch = input.match(/--promise\s+"([^"]+)"/)
  const prompt = input
    .replace(/^\/ralph-loop\s*/, "")
    .replace(/--max\s+\d+/, "")
    .replace(/--promise\s+"[^"]+"/, "")
    .trim()

  return {
    kind: "start" as const,
    prompt,
    maxIterations: maxMatch ? Number(maxMatch[1]) : undefined,
    completionPromise: promiseMatch?.[1] ?? "<promise>DONE</promise>",
  }
}
```

- [ ] **Step 4: 補一個拒絕 reset 的測試與實作**

```ts
it("rejects reset strategy in v1", () => {
  expect(() => parseRalphLoopCommand("/ralph-loop --strategy reset task")).toThrow(
    "reset strategy is not supported in v1"
  )
})
```

- [ ] **Step 5: 跑測試確認通過**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/parse-ralph-loop-command.ts tests/commands/parse-ralph-loop-command.test.ts
git commit -m "feat: add Ralph Loop command parser"
```

---

### Task 3: 用 TDD 建立 state-store 與核心型別

**Files:**
- Create: `src/ralph-loop/constants.ts`
- Create: `src/ralph-loop/types.ts`
- Create: `src/ralph-loop/state-store.ts`
- Test: `tests/ralph-loop/state-store.test.ts`

- [ ] **Step 1: 寫 state-store 失敗測試**

```ts
import { describe, expect, it } from "bun:test"
import { readState, writeState, clearState } from "../../src/ralph-loop/state-store"

describe("state-store", () => {
  it("writes and reads .loop/ralph-loop.local.md", async () => {
    await writeState(process.cwd(), {
      active: true,
      session_id: "s1",
      prompt: "build plugin",
      iteration: 0,
      max_iterations: 3,
      completion_promise: "<promise>DONE</promise>",
      message_count_at_start: 0,
      started_at: "2026-03-23T00:00:00.000Z",
    })
    const state = await readState(process.cwd())
    expect(state?.session_id).toBe("s1")
  })

  it("clears persisted state", async () => {
    await clearState(process.cwd())
    expect(await readState(process.cwd())).toBeNull()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/ralph-loop/state-store.test.ts`
Expected: FAIL，因為 state-store 尚未實作

- [ ] **Step 3: 定義常數與型別**

```ts
export const DEFAULT_STATE_PATH = ".loop/ralph-loop.local.md"
export const DEFAULT_COMPLETION_PROMISE = "<promise>DONE</promise>"

export interface RalphLoopState {
  active: boolean
  session_id: string
  prompt: string
  iteration: number
  max_iterations?: number
  completion_promise: string
  message_count_at_start: number
  started_at: string
}
```

- [ ] **Step 4: 實作最小 state-store**

```ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

export async function writeState(root: string, state: RalphLoopState) {
  const filePath = join(root, ".loop", "ralph-loop.local.md")
  await mkdir(join(root, ".loop"), { recursive: true })
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8")
}

export async function readState(root: string) {
  const filePath = join(root, ".loop", "ralph-loop.local.md")
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as RalphLoopState
  } catch {
    return null
  }
}

export async function clearState(root: string) {
  const filePath = join(root, ".loop", "ralph-loop.local.md")
  await rm(filePath, { force: true })
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `bun test tests/ralph-loop/state-store.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ralph-loop/constants.ts src/ralph-loop/types.ts src/ralph-loop/state-store.ts tests/ralph-loop/state-store.test.ts
git commit -m "feat: add persisted Ralph Loop state store"
```

---

### Task 4: 用 TDD 建立 completion detector 與 continuation prompt builder

**Files:**
- Create: `src/ralph-loop/completion-detector.ts`
- Create: `src/ralph-loop/continuation-prompt.ts`
- Test: `tests/ralph-loop/completion-detector.test.ts`

- [ ] **Step 1: 寫 completion detector 失敗測試**

```ts
import { describe, expect, it } from "bun:test"
import { detectCompletion } from "../../src/ralph-loop/completion-detector"

describe("detectCompletion", () => {
  it("finds completion promise only in assistant text after boundary", () => {
    const messages = [
      { role: "user", text: "<promise>DONE</promise>" },
      { role: "assistant", text: "working" },
      { role: "assistant", text: "<promise>DONE</promise>" },
    ]
    expect(detectCompletion(messages, "<promise>DONE</promise>", 1)).toBe(true)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/ralph-loop/completion-detector.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作最小 detector 與 continuation builder**

```ts
export function detectCompletion(messages: Array<{ role: string; text: string }>, promise: string, boundary: number) {
  return messages
    .slice(boundary)
    .some((message) => message.role === "assistant" && message.text.includes(promise))
}

export function buildContinuationPrompt(input: { prompt: string; iteration: number; maxIterations?: number; completionPromise: string }) {
  return [
    `Continue Ralph Loop iteration ${input.iteration}.`,
    `Original task: ${input.prompt}`,
    `Emit ${input.completionPromise} when complete.`,
  ].join("\n")
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `bun test tests/ralph-loop/completion-detector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ralph-loop/completion-detector.ts src/ralph-loop/continuation-prompt.ts tests/ralph-loop/completion-detector.test.ts
git commit -m "feat: add completion detection and continuation prompt"
```

---

### Task 5: 用 TDD 建立 host-adapter 與 loop-core

**Files:**
- Create: `src/host-adapter/types.ts`
- Create: `src/host-adapter/opencode-host-adapter.ts`
- Create: `src/ralph-loop/loop-core.ts`
- Test: `tests/ralph-loop/loop-core.test.ts`

- [ ] **Step 1: 寫 loop-core 失敗測試**

```ts
import { describe, expect, it, mock } from "bun:test"
import { createLoopCore } from "../../src/ralph-loop/loop-core"

describe("loop-core", () => {
  it("injects continuation when completion is not found", async () => {
    const adapter = {
      getMessageCount: mock(async () => 0),
      getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
      prompt: mock(async () => undefined),
      sessionExists: mock(async () => true),
      abortSession: mock(async () => undefined),
    }

    const core = createLoopCore({ rootDir: process.cwd(), adapter })
    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(adapter.prompt).toHaveBeenCalled()
  })

  it("ignores duplicate idle while a handler run is in flight", async () => {
    let resolvePrompt!: () => void
    const adapter = {
      getMessageCount: mock(async () => 0),
      getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
      prompt: mock(() => new Promise<void>((resolve) => { resolvePrompt = resolve })),
      sessionExists: mock(async () => true),
      abortSession: mock(async () => undefined),
    }

    const core = createLoopCore({ rootDir: process.cwd(), adapter })
    await core.startLoop("s1", "build plugin", { maxIterations: 3 })

    const first = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    const second = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    resolvePrompt()
    await Promise.all([first, second])

    expect(adapter.prompt).toHaveBeenCalledTimes(1)
  })

  it("persists and reuses custom completion promise across iterations", async () => {
    const adapter = {
      getMessageCount: mock(async () => 0),
      getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
      prompt: mock(async (_sessionID: string, text: string) => {
        expect(text).toContain("<promise>SHIP</promise>")
      }),
      sessionExists: mock(async () => true),
      abortSession: mock(async () => undefined),
    }

    const core = createLoopCore({ rootDir: process.cwd(), adapter })
    await core.startLoop("s1", "build plugin", { maxIterations: 3, completionPromise: "<promise>SHIP</promise>" })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    const state = await readState(process.cwd())
    expect(state?.completion_promise).toBe("<promise>SHIP</promise>")
    expect(adapter.prompt).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/ralph-loop/loop-core.test.ts`
Expected: FAIL

- [ ] **Step 3: 定義 host adapter 介面**

```ts
export interface HostAdapter {
  getMessageCount(sessionID: string): Promise<number>
  getMessages(sessionID: string): Promise<Array<{ role: string; text: string }>>
  prompt(sessionID: string, text: string): Promise<void>
  abortSession(sessionID: string): Promise<void>
  sessionExists(sessionID: string): Promise<boolean>
}
```

- [ ] **Step 4: 實作 `src/host-adapter/opencode-host-adapter.ts`**

```ts
import type { HostAdapter } from "./types"

export function createOpenCodeHostAdapter(ctx: {
  directory: string
  client: {
    session: {
      messages: (input: { path: { id: string }; query: { directory: string } }) => Promise<unknown>
      promptAsync?: (input: { path: { id: string }; body: { parts: Array<{ type: "text"; text: string }> }; query: { directory: string } }) => Promise<unknown>
      prompt: (input: { path: { id: string }; body: { parts: Array<{ type: "text"; text: string }> }; query: { directory: string } }) => Promise<unknown>
      abort: (input: { path: { id: string } }) => Promise<unknown>
    }
  }
}): HostAdapter {
  return {
    async getMessageCount(sessionID) {
      const response = await ctx.client.session.messages({ path: { id: sessionID }, query: { directory: ctx.directory } })
      if (Array.isArray(response)) return response.length
      if (response && typeof response === "object" && "data" in response && Array.isArray((response as { data?: unknown }).data)) {
        return ((response as { data: unknown[] }).data).length
      }
      return 0
    },
    async getMessages(sessionID) {
      const response = await ctx.client.session.messages({ path: { id: sessionID }, query: { directory: ctx.directory } })
      const list = Array.isArray(response) ? response : []

      return list.map((item) => {
        const info = (item as { info?: { role?: unknown } }).info
        const parts = Array.isArray((item as { parts?: unknown }).parts) ? (item as { parts: Array<{ type?: unknown; text?: unknown }> }).parts : []

        return {
          role: typeof info?.role === "string" ? info.role : "unknown",
          text: parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text as string)
            .join("\n"),
        }
      })
    },
    async prompt(sessionID, text) {
      const input = {
        path: { id: sessionID },
        body: { parts: [{ type: "text", text }] },
        query: { directory: ctx.directory },
      }

      if (ctx.client.session.promptAsync) {
        await ctx.client.session.promptAsync(input)
        return
      }

      await ctx.client.session.prompt(input)
    },
    async abortSession(sessionID) {
      await ctx.client.session.abort({ path: { id: sessionID } })
    },
    async sessionExists(sessionID) {
      try {
        await ctx.client.session.messages({ path: { id: sessionID }, query: { directory: ctx.directory } })
        return true
      } catch {
        return false
      }
    },
  }
}
```

- [ ] **Step 5: 實作最小 loop-core**

```ts
export function createLoopCore(deps: { rootDir: string; adapter: HostAdapter }) {
  const inFlight = new Set<string>()

  return {
    async startLoop(sessionID: string, prompt: string, options: { maxIterations?: number; completionPromise?: string }) {
      const existing = await readState(deps.rootDir)
      if (existing?.active) {
        const exists = await deps.adapter.sessionExists(existing.session_id)
        if (exists) {
          throw new Error("an active Ralph Loop already exists; use /cancel-ralph first")
        }
        await clearState(deps.rootDir)
      }

      const messageCountAtStart = await deps.adapter.getMessageCount(sessionID)

      await writeState(deps.rootDir, {
        active: true,
        session_id: sessionID,
        prompt,
        iteration: 0,
        max_iterations: options.maxIterations,
        completion_promise: options.completionPromise ?? "<promise>DONE</promise>",
        message_count_at_start: messageCountAtStart,
        started_at: new Date().toISOString(),
      })
    },
    async cancelLoop(sessionID: string) {
      const state = await readState(deps.rootDir)
      if (!state?.active || state.session_id !== sessionID) return
      await deps.adapter.abortSession(sessionID)
      await clearState(deps.rootDir)
    },
    async handleEvent(event: { type: string; sessionID: string }) {
      if (inFlight.has(event.sessionID)) return
      inFlight.add(event.sessionID)

      try {
        const state = await readState(deps.rootDir)
        if (!state?.active || state.session_id !== event.sessionID) return

        if (event.type === "session.deleted" || event.type === "session.error") {
          await clearState(deps.rootDir)
          return
        }

        const messages = await deps.adapter.getMessages(event.sessionID)
        const done = detectCompletion(messages, state.completion_promise, state.message_count_at_start)
        if (done) {
          await clearState(deps.rootDir)
          return
        }

        const nextIteration = state.iteration + 1
        if (typeof state.max_iterations === "number" && nextIteration > state.max_iterations) {
          await clearState(deps.rootDir)
          return
        }

        await writeState(deps.rootDir, { ...state, iteration: nextIteration })
        await deps.adapter.prompt(event.sessionID, buildContinuationPrompt({
          prompt: state.prompt,
          iteration: nextIteration,
          maxIterations: state.max_iterations,
          completionPromise: state.completion_promise,
        }))
      } finally {
        inFlight.delete(event.sessionID)
      }
    },
  }
}
```

- [ ] **Step 6: 補足其餘路徑測試**

新增測試：
- 完成時 clear state
- 超過 `max_iterations` 時不再 prompt
- `/cancel-ralph` 會 abort session 並 clear state
- custom `--promise` 會寫入 state、供 completion detector 使用、並出現在 continuation prompt
- `session.deleted` 時 clear state
- `session.error` 時 clear state
- active loop session 存在時拒絕新 loop
- active loop session 不存在時先清 stale state 再啟動
- `sessionExists()` 回傳 false 時會走 stale state recovery
- boundary 不得命中啟動前訊息
- duplicate idle 只允許一次 continuation

- [ ] **Step 7: 跑測試確認通過**

Run: `bun test tests/ralph-loop/loop-core.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/host-adapter/types.ts src/host-adapter/opencode-host-adapter.ts src/ralph-loop/loop-core.ts tests/ralph-loop/loop-core.test.ts
git commit -m "feat: add Ralph Loop core runtime"
```

---

### Task 6: 接上 plugin handlers 並補最小整合測試

**Files:**
- Modify: `src/plugin/create-plugin.ts`
- Create: `src/plugin/chat-message-handler.ts`
- Create: `src/plugin/event-handler.ts`
- Test: `tests/plugin/plugin-integration.test.ts`

- [ ] **Step 1: 寫整合測試**

```ts
import { describe, expect, it, mock } from "bun:test"
import { handleChatMessage } from "../../src/plugin/chat-message-handler"
import { handleEvent } from "../../src/plugin/event-handler"

describe("plugin integration", () => {
  it("starts loop on /ralph-loop and continues on session.idle", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

    await handleChatMessage({ sessionID: "s1", text: "/ralph-loop --max 3 build plugin" }, { core })
    await handleEvent({ type: "session.idle", properties: { sessionID: "s1" } }, { core })

    expect(core.startLoop).toHaveBeenCalled()
    expect(core.handleEvent).toHaveBeenCalledWith({ type: "session.idle", sessionID: "s1" })
  })

  it("extracts deleted session id from properties.info.id", async () => {
    const core = { handleEvent: mock(async () => undefined) }
    await handleEvent({ type: "session.deleted", properties: { info: { id: "s2" } } }, { core })
    expect(core.handleEvent).toHaveBeenCalledWith({ type: "session.deleted", sessionID: "s2" })
  })

  it("forwards session.error using properties.sessionID", async () => {
    const core = { handleEvent: mock(async () => undefined) }
    await handleEvent({ type: "session.error", properties: { sessionID: "s3" } }, { core })
    expect(core.handleEvent).toHaveBeenCalledWith({ type: "session.error", sessionID: "s3" })
  })

  it("routes /cancel-ralph to core.cancelLoop", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

    await handleChatMessage({ sessionID: "s1", text: "/cancel-ralph" }, { core })
    expect(core.cancelLoop).toHaveBeenCalledWith("s1")
  })

  it("passes custom completion promise to core.startLoop", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

    await handleChatMessage({ sessionID: "s1", text: '/ralph-loop --promise "<promise>SHIP</promise>" build plugin' }, { core })
    expect(core.startLoop).toHaveBeenCalledWith("s1", "build plugin", {
      maxIterations: undefined,
      completionPromise: "<promise>SHIP</promise>",
    })
  })

  it("ignores plain chat messages", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

    await handleChatMessage({ sessionID: "s1", text: "hello world" }, { core })
    expect(core.startLoop).not.toHaveBeenCalled()
    expect(core.cancelLoop).not.toHaveBeenCalled()
  })

  it("ignores unrelated events", async () => {
    const core = { handleEvent: mock(async () => undefined) }
    await handleEvent({ type: "session.created", properties: { sessionID: "s9" } }, { core })
    expect(core.handleEvent).not.toHaveBeenCalled()
  })

  it("extracts chat text from output.parts TextPart items", async () => {
    // assert createPlugin chat hook derives command text from output.parts text fragments
  })

  it("host adapter prefers promptAsync and falls back to prompt", async () => {
    // assert continuation path uses promptAsync when available
  })

  it("host adapter extracts assistant text from session.messages parts", async () => {
    // assert adapter maps Array<{ info, parts }> into { role, text }
    // and only text parts are concatenated
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `bun test tests/plugin/plugin-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `chat-message-handler.ts`**

```ts
export async function handleChatMessage(input: { sessionID: string; text: string }, deps: { core: ReturnType<typeof createLoopCore> }) {
  const command = parseRalphLoopCommand(input.text)
  if (!command) return
  if (command.kind === "cancel") return deps.core.cancelLoop(input.sessionID)
  return deps.core.startLoop(input.sessionID, command.prompt, {
    maxIterations: command.maxIterations,
    completionPromise: command.completionPromise,
  })
}
```

- [ ] **Step 4: 以 `unknown + type guards` 實作 `event-handler.ts`**

```ts
function getEventSessionID(event: { type: string; properties?: unknown }) {
  if (event.type === "session.deleted") {
    const properties = event.properties as { info?: { id?: unknown } } | undefined
    return typeof properties?.info?.id === "string" ? properties.info.id : undefined
  }

  const properties = event.properties as { sessionID?: unknown } | undefined
  return typeof properties?.sessionID === "string" ? properties.sessionID : undefined
}

export async function handleEvent(event: { type: string; properties?: unknown }, deps: { core: ReturnType<typeof createLoopCore> }) {
  if (!["session.idle", "session.deleted", "session.error"].includes(event.type)) return
  const sessionID = getEventSessionID(event)
  if (!sessionID) return
  await deps.core.handleEvent({ type: event.type, sessionID })
}
```

- [ ] **Step 5: 將 `create-plugin.ts` 改為真實接線**

```ts
import { createOpenCodeHostAdapter } from "../host-adapter/opencode-host-adapter"
import { createLoopCore } from "../ralph-loop/loop-core"
import { handleChatMessage } from "./chat-message-handler"
import { handleEvent } from "./event-handler"

export function createPlugin(ctx: {
  directory: string
  client: unknown
}) {
  const adapter = createOpenCodeHostAdapter(ctx as never)
  const core = createLoopCore({ rootDir: ctx.directory, adapter })

  return {
    "chat.message": async (input: { sessionID: string }, output: { parts?: Array<{ type: string; text?: string }> }) => {
      const text = output.parts?.filter((part) => part.type === "text" && part.text).map((part) => part.text).join("\n") ?? ""
      await handleChatMessage({ sessionID: input.sessionID, text }, { core })
    },
    event: async (input: { event: { type: string; properties?: unknown } }) => {
      await handleEvent(input.event, { core })
    },
  }
}
```

- [ ] **Step 6: 補一個 plugin shell 接線測試**

```ts
it("createPlugin wires host adapter, core, chat handler, and event handler", async () => {
  // mock createOpenCodeHostAdapter/createLoopCore if needed
  // assert returned hooks call through to handler layer
})
```

- [ ] **Step 7: 跑完整測試**

Run: `bun test`
Expected: 全部 PASS

- [ ] **Step 8: 跑型別檢查**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/plugin/create-plugin.ts src/plugin/chat-message-handler.ts src/plugin/event-handler.ts tests/plugin/plugin-integration.test.ts
git commit -m "feat: wire Ralph Loop plugin handlers"
```

---

## Final Verification

- [ ] Run: `bun test`
- [ ] Expected: 所有 tests PASS
- [ ] Run: `bun run typecheck`
- [ ] Expected: 無 type errors
- [ ] Confirm `.loop/` is ignored by git

## Required Test Matrix

- [ ] command parser: ignore non-command text / start / cancel / reject reset
- [ ] command parser: custom `--promise`
- [ ] state-store: write / read / clear / missing file
- [ ] completion detector: assistant-only / boundary / false positive prevention
- [ ] loop-core: done / continue / max reached / cancel / session.deleted / session.error
- [ ] loop-core: custom `--promise` end-to-end through state + continuation prompt
- [ ] loop-core: duplicate idle guard / stale state recovery / reject second active loop
- [ ] integration: `/ralph-loop` wiring / `/cancel-ralph` wiring / custom promise forwarding / `session.idle` wiring / deleted session id extraction / session.error wiring
- [ ] integration: ignore unrelated events outside `session.idle / deleted / error`
- [ ] integration: `output.parts` text extraction / `promptAsync` preference with `prompt` fallback
- [ ] integration: `session.messages` assistant text extraction from `{ info, parts }`
