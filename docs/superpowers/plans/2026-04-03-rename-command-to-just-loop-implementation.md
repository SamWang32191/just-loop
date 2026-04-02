# Rename command to `just-loop` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將使用者可輸入的主 command 從 `/ralph-loop` 改為 `/just-loop`，且不改動 `/cancel-ralph`。

**Architecture:** 先用測試鎖定對外行為，再做最小必要實作。只修改 command 註冊點與 parser 對主 command 的辨識，讓其他 loop runtime 與取消流程維持不變。

**Tech Stack:** TypeScript, Bun test, OpenCode plugin hooks

---

## File Structure

- `src/commands/parse-ralph-loop-command.ts`
  - 主 command parser；決定哪些 slash command 會被辨識為 start/cancel
- `src/plugin/command-definitions.ts`
  - builtin command 註冊；決定 config 中暴露給使用者的 command key/name
- `tests/commands/parse-ralph-loop-command.test.ts`
  - parser 單元測試；鎖定 `/just-loop` 的解析與 lookalike 拒絕行為
- `tests/plugin/plugin-integration.test.ts`
  - plugin integration 測試；鎖定 hook wiring 與 config command 註冊結果

## Task 1: Update parser tests for `/just-loop`

**Files:**
- Modify: `tests/commands/parse-ralph-loop-command.test.ts`
- Modify: `src/commands/parse-ralph-loop-command.ts`
- Test: `tests/commands/parse-ralph-loop-command.test.ts`

- [ ] **Step 1: Write the failing parser test updates**

Replace the old `/ralph-loop` expectations with `/just-loop` expectations in `tests/commands/parse-ralph-loop-command.test.ts`.

```ts
import { describe, expect, it } from "bun:test"
import { parseRalphLoopCommand } from "../../src/commands/parse-ralph-loop-command"
import { DEFAULT_COMPLETION_PROMISE } from "../../src/ralph-loop/constants"

describe("parseRalphLoopCommand", () => {
  it("returns null for non-command text", () => {
    expect(parseRalphLoopCommand("hello world")).toBeNull()
  })

  it("returns null for lookalike commands", () => {
    expect(parseRalphLoopCommand("/just-loopx test")).toBeNull()
  })

  it("parses cancel command", () => {
    expect(parseRalphLoopCommand("/cancel-ralph")).toEqual({ kind: "cancel" })
  })

  it("parses prompt and max iterations", () => {
    expect(parseRalphLoopCommand("/just-loop --max 3 build plugin")).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: 3,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("parses canonical equals-style flags and continue strategy", () => {
    expect(
      parseRalphLoopCommand("/just-loop --max-iterations=7 --completion-promise=SHIP --strategy=continue task"),
    ).toEqual({
      kind: "start",
      prompt: "task",
      maxIterations: 7,
      completionPromise: "SHIP",
    })
  })

  it("parses custom completion promise", () => {
    expect(
      parseRalphLoopCommand('/just-loop --promise "<promise>SHIP</promise>" build plugin'),
    ).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: undefined,
      completionPromise: "<promise>SHIP</promise>",
    })
  })

  it("keeps flag-like text inside the prompt", () => {
    expect(parseRalphLoopCommand("/just-loop build --max 3 plugin")).toEqual({
      kind: "start",
      prompt: "build --max 3 plugin",
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("treats trailing canonical flags as prompt text", () => {
    expect(parseRalphLoopCommand("/just-loop build --max-iterations=7")).toEqual({
      kind: "start",
      prompt: "build --max-iterations=7",
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("rejects invalid max values", () => {
    expect(() => parseRalphLoopCommand("/just-loop --max -1 task")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max foo task")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max 3foo task")).toThrow()
  })

  it("rejects unterminated promise flags", () => {
    expect(() => parseRalphLoopCommand('/just-loop --promise "SHIP task')).toThrow()
  })

  it("rejects promise values that do not end cleanly", () => {
    expect(() => parseRalphLoopCommand('/just-loop --promise "X"build')).toThrow()
  })

  it("treats lookalike flags as unknown", () => {
    expect(() => parseRalphLoopCommand("/just-loop --maxx 3 task")).toThrow("unknown flag")
    expect(() => parseRalphLoopCommand('/just-loop --promiseful "X" task')).toThrow(
      "unknown flag",
    )
    expect(() => parseRalphLoopCommand("/just-loop --strategyy reset task")).toThrow(
      "unknown flag",
    )
  })

  it("rejects empty prompt", () => {
    expect(() => parseRalphLoopCommand("/just-loop")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max 3")).toThrow()
  })

  it("rejects reset strategy in v1", () => {
    expect(() => parseRalphLoopCommand("/just-loop --strategy reset task")).toThrow(
      "reset strategy is not supported in v1",
    )
  })
})
```

- [ ] **Step 2: Run parser test to verify it fails**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts`
Expected: FAIL because `parseRalphLoopCommand()` still only accepts `/ralph-loop`.

- [ ] **Step 3: Write the minimal parser implementation**

Update `src/commands/parse-ralph-loop-command.ts` so the start command path switches from `/ralph-loop` to `/just-loop`, while cancel stays `/cancel-ralph`.

```ts
import { DEFAULT_COMPLETION_PROMISE } from "../ralph-loop/constants.js"

export type RalphLoopStartCommand = {
  kind: "start"
  prompt: string
  maxIterations?: number
  completionPromise: string
}

export type RalphLoopCancelCommand = {
  kind: "cancel"
}

export type ParsedRalphLoopCommand = RalphLoopStartCommand | RalphLoopCancelCommand

export function parseRalphLoopCommand(input: string): ParsedRalphLoopCommand | null {
  const trimmed = input.trim()

  if (trimmed === "/cancel-ralph") {
    return { kind: "cancel" }
  }

  if (!/^\/just-loop(?:\s|$)/.test(trimmed)) {
    return null
  }

  let rest = trimmed.slice("/just-loop".length)
  let maxIterations: number | undefined
  let completionPromise = DEFAULT_COMPLETION_PROMISE

  while (true) {
    rest = rest.replace(/^\s+/, "")

    if (!rest.startsWith("--")) {
      break
    }

    if (/^--max-iterations=/.test(rest)) {
      const valueMatch = rest.match(/^--max-iterations=([0-9]+)(?:\s+|$)/)
      if (!valueMatch) {
        throw new Error("invalid --max-iterations value")
      }

      maxIterations = Number(valueMatch[1])
      rest = rest.slice(valueMatch[0].length)
      continue
    }

    if (/^--max(?:\s|$)/.test(rest)) {
      const valueMatch = rest.match(/^--max(?:\s+(\S+))(?:\s+|$)/)
      if (!valueMatch || !/^[0-9]+$/.test(valueMatch[1])) {
        throw new Error("invalid --max value")
      }

      maxIterations = Number(valueMatch[1])
      rest = rest.slice(valueMatch[0].length)
      continue
    }

    if (/^--promise(?:\s|$)/.test(rest)) {
      const promiseMatch = rest.match(/^--promise\s+"([^"]+)"(?:\s+|$)/)
      if (!promiseMatch) {
        throw new Error("invalid --promise format")
      }

      completionPromise = promiseMatch[1]
      rest = rest.slice(promiseMatch[0].length)
      continue
    }

    if (/^--completion-promise=/.test(rest)) {
      const promiseMatch = rest.match(/^--completion-promise=([^\s]+)(?:\s+|$)/)
      if (!promiseMatch) {
        throw new Error("invalid --completion-promise format")
      }

      completionPromise = promiseMatch[1]
      rest = rest.slice(promiseMatch[0].length)
      continue
    }

    if (/^--strategy(?:\s|$)/.test(rest)) {
      const strategyMatch = rest.match(/^--strategy(?:\s+(\S+))(?:\s+|$)/)
      if (!strategyMatch) {
        throw new Error("invalid --strategy value")
      }

      if (strategyMatch[1] === "reset") {
        throw new Error("reset strategy is not supported in v1")
      }

      throw new Error("invalid --strategy value")
    }

    if (/^--strategy=/.test(rest)) {
      const strategyMatch = rest.match(/^--strategy=([^\s]+)(?:\s+|$)/)
      if (!strategyMatch) {
        throw new Error("invalid --strategy value")
      }

      if (strategyMatch[1] === "continue") {
        rest = rest.slice(strategyMatch[0].length)
        continue
      }

      if (strategyMatch[1] === "reset") {
        throw new Error("reset strategy is not supported in v1")
      }

      throw new Error("invalid --strategy value")
    }

    throw new Error("unknown flag")
  }

  const prompt = rest.trim().replace(/\s+/g, " ")

  if (!prompt) {
    throw new Error("prompt is required")
  }

  return {
    kind: "start",
    prompt,
    maxIterations,
    completionPromise,
  }
}
```

- [ ] **Step 4: Run parser test to verify it passes**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit parser rename slice if explicitly requested**

If the user has asked for a commit, run:

```bash
git add tests/commands/parse-ralph-loop-command.test.ts src/commands/parse-ralph-loop-command.ts
git commit -m "fix: rename main loop command to just-loop"
```

If the user has not asked for a commit, skip this step.

## Task 2: Update plugin integration tests and builtin command registration

**Files:**
- Modify: `tests/plugin/plugin-integration.test.ts`
- Modify: `src/plugin/command-definitions.ts`
- Test: `tests/plugin/plugin-integration.test.ts`

- [ ] **Step 1: Write the failing integration test updates**

Change the integration tests so they expect `/just-loop` in hook wiring and `commands["just-loop"]` in config registration.

```ts
it("wires /just-loop to startLoop with parsed options", async () => {
  const startLoop = mock(async () => undefined)
  const cancelLoop = mock(async () => undefined)

  await handleChatMessage("/just-loop --max 4 --promise \"<promise>SHIP</promise>\" build plugin", {
    startLoop,
    cancelLoop,
  } as any, "session-1")

  expect(startLoop).toHaveBeenCalledTimes(1)
  expect(startLoop).toHaveBeenCalledWith(
    "session-1",
    "build plugin",
    {
      maxIterations: 4,
      completionPromise: "<promise>SHIP</promise>",
    },
  )
  expect(cancelLoop).not.toHaveBeenCalled()
})

it("wires canonical equals-style /just-loop flags to startLoop with parsed options", async () => {
  const startLoop = mock(async () => undefined)
  const cancelLoop = mock(async () => undefined)

  await handleChatMessage("/just-loop --max-iterations=7 --completion-promise=SHIP --strategy=continue task", {
    startLoop,
    cancelLoop,
  } as any, "session-1b")

  expect(startLoop).toHaveBeenCalledTimes(1)
  expect(startLoop).toHaveBeenCalledWith(
    "session-1b",
    "task",
    {
      maxIterations: 7,
      completionPromise: "SHIP",
    },
  )
  expect(cancelLoop).not.toHaveBeenCalled()
})

it("registers formal just-loop and cancel-ralph commands in config", async () => {
  const plugin = await createPlugin(
    {
      directory: "/workspace",
      client: {
        session: {
          messages: mock(async () => []),
          promptAsync: mock(async () => undefined),
          prompt: mock(async () => undefined),
          abort: mock(async () => undefined),
        },
      },
    } as any,
    {
      createOpenCodeHostAdapter: mock(() => ({
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => []),
        prompt: mock(async () => undefined),
        abortSession: mock(async () => undefined),
        sessionExists: mock(async () => true),
      }) as any),
      createLoopCore: mock(() => ({
        startLoop: mock(async () => undefined),
        cancelLoop: mock(async () => undefined),
        handleEvent: mock(async () => undefined),
      }) as any),
    },
  )

  const config: Record<string, unknown> = {
    ralph_loop: {
      enabled: true,
    },
  }
  await plugin.config?.(config as any)

  const commands = config.command as Record<string, { description?: string; template?: string }>
  expect(commands["just-loop"]).toBeDefined()
  expect(commands["just-loop"]?.description).toContain("Start self-referential development loop")
  expect(commands["just-loop"]?.template).toContain("You are starting a Ralph Loop")
  expect(commands["just-loop"]?.template).toContain("--max-iterations=N")
  expect(commands["just-loop"]?.template).toContain("--completion-promise=TEXT")
  expect(commands["just-loop"]?.template).toContain("--strategy=continue")
  expect(commands["cancel-ralph"]).toBeDefined()
})
```

Also replace remaining integration test input strings such as:

```ts
name: "/just-loop build plugin"
```

and:

```ts
{ parts: [{ type: "text", text: "/just-loop build plugin" }] }
```

- [ ] **Step 2: Run integration test to verify it fails**

Run: `bun test tests/plugin/plugin-integration.test.ts`
Expected: FAIL because builtin command registration still exposes `ralph-loop`.

- [ ] **Step 3: Update builtin command registration**

Change only the public command key/name in `src/plugin/command-definitions.ts`.

```ts
export function getBuiltinCommands(): Record<string, CommandDefinition> {
  return {
    "just-loop": {
      name: "just-loop",
      description: "(builtin) Start self-referential development loop until completion",
      template: `<command-instruction>
${RALPH_LOOP_TEMPLATE}
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
    },
    "cancel-ralph": {
      name: "cancel-ralph",
      description: "(builtin) Cancel active Ralph Loop",
      template: `<command-instruction>
${CANCEL_RALPH_TEMPLATE}
</command-instruction>`,
    },
  }
}
```

- [ ] **Step 4: Run integration test to verify it passes**

Run: `bun test tests/plugin/plugin-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit integration rename slice if explicitly requested**

If the user has asked for a commit, run:

```bash
git add tests/plugin/plugin-integration.test.ts src/plugin/command-definitions.ts
git commit -m "fix: expose just-loop builtin command"
```

If the user has not asked for a commit, skip this step.

## Task 3: Run cross-check verification for the renamed command

**Files:**
- Verify only: `src/commands/parse-ralph-loop-command.ts`
- Verify only: `src/plugin/command-definitions.ts`
- Verify only: `tests/commands/parse-ralph-loop-command.test.ts`
- Verify only: `tests/plugin/plugin-integration.test.ts`

- [ ] **Step 1: Run language-server diagnostics on changed files**

Run diagnostics for:

```text
src/commands/parse-ralph-loop-command.ts
src/plugin/command-definitions.ts
tests/commands/parse-ralph-loop-command.test.ts
tests/plugin/plugin-integration.test.ts
```

Expected: no errors.

- [ ] **Step 2: Run both focused test files together**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts tests/plugin/plugin-integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the full project test command**

Run: `bun run test`
Expected: PASS after the build step and the full test suite both complete successfully.

- [ ] **Step 4: Inspect for unintended scope growth**

Check that only these behavior changes occurred:

```text
- /just-loop is the start command
- /cancel-ralph is unchanged
- parser flags and loop semantics are unchanged
```

Expected: no extra runtime or docs changes beyond the spec scope.

- [ ] **Step 5: Commit final verification state if explicitly requested**

If the user has asked for a commit, run:

```bash
git add src/commands/parse-ralph-loop-command.ts src/plugin/command-definitions.ts tests/commands/parse-ralph-loop-command.test.ts tests/plugin/plugin-integration.test.ts
git commit -m "fix: rename the main loop command to just-loop"
```

If the user has not asked for a commit, skip this step.
