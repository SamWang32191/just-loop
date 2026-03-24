# Ralph Loop Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 對齊 `just-loop` 與 reference Ralph Loop 的三個缺口：command contract、runtime config、orphaned state recovery，同時維持本專案的最小 continue-only 範圍。

**Architecture:** 保持現有薄殼 plugin + `src/ralph-loop/` core 架構。command contract 與 plugin config 由 `src/plugin/` 內聚管理，loop 行為與 stale-state 清理由 `src/ralph-loop/loop-core.ts` 處理；不引入 `/ulw-loop`、oracle verification、transcript fallback。

**Tech Stack:** TypeScript, Bun test, `@opencode-ai/plugin`

---

## Recalled Lessons

- `ralph-loop-state-store-path`: Ralph Loop state path 必須固定為 `.loop/ralph-loop.local.md`，不要移植 reference 的 `state_dir` / `.sisyphus` 行為。
- `opencode-formal-command-needs-config-and-tool-hook`: formal command 仍然要同時走 `config` 註冊與 `tool.execute.before` side effect，不能只做其中一條。

## Scope Decisions

- canonical command surface 對齊 reference/documentation：`--max-iterations=N`、`--completion-promise=TEXT`、`--strategy=continue`
- 為避免不必要破壞，保留目前 `--max N`、`--promise "TEXT"` 作為向後相容 alias
- `state_dir` **不納入** 本次 config 面，因為違反本專案固定 state path 規則
- `reset strategy` 仍維持未支援；本次只把 `continue` 納入顯式 contract
- 不在本 plan 內補 `chat.message` 啟動路徑、`/ulw-loop`、verification 分支

## Planned File Structure

### Create
- `src/plugin/plugin-config.ts` - Ralph Loop plugin config 的 normalize、default 值、runtime 狀態承載

### Modify
- `src/plugin/create-plugin.ts` - 持有 resolved config，將 config 傳給 command 定義與 loop core
- `src/plugin/config-handler.ts` - 依 config 決定是否註冊 commands，並更新 runtime config
- `src/plugin/command-definitions.ts` - 對齊 reference-style command contract 文案
- `src/commands/parse-ralph-loop-command.ts` - 支援 canonical long flags 與 legacy alias
- `src/ralph-loop/constants.ts` - 新增 default max iterations / default strategy 常數
- `src/ralph-loop/types.ts` - 補 plugin config / loop default 所需型別
- `src/ralph-loop/loop-core.ts` - 套用 config default，並在 idle 時清理 orphaned state
- `tests/commands/parse-ralph-loop-command.test.ts` - command contract 對齊測試
- `tests/plugin/plugin-integration.test.ts` - config hook、command registration、runtime default 行為測試
- `tests/ralph-loop/loop-core.test.ts` - default max / orphaned state recovery 測試
- `README.md` - 若有 command 使用方式描述，更新成 canonical contract

---

### Task 1: Align command contract with the documented/reference surface

**Files:**
- Modify: `src/plugin/command-definitions.ts`
- Modify: `src/commands/parse-ralph-loop-command.ts`
- Modify: `src/ralph-loop/constants.ts`
- Test: `tests/commands/parse-ralph-loop-command.test.ts`
- Test: `tests/plugin/plugin-integration.test.ts`
- Optional doc touch: `README.md`

- [ ] **Step 1: 寫失敗測試，鎖定 canonical flags 與 alias 行為**

```ts
it("parses canonical equals-style long flags", () => {
  expect(
    parseRalphLoopCommand("/ralph-loop --max-iterations=7 --completion-promise=SHIP task"),
  ).toEqual({
    kind: "start",
    prompt: "task",
    maxIterations: 7,
    completionPromise: "SHIP",
    strategy: "continue",
  })
})

it("accepts explicit continue strategy", () => {
  expect(
    parseRalphLoopCommand("/ralph-loop --strategy=continue task"),
  ).toMatchObject({
    kind: "start",
    prompt: "task",
    strategy: "continue",
  })
})

it("keeps supporting legacy aliases", () => {
  expect(
    parseRalphLoopCommand('/ralph-loop --max 3 --promise "<promise>SHIP</promise>" task'),
  ).toMatchObject({
    kind: "start",
    maxIterations: 3,
    completionPromise: "<promise>SHIP</promise>",
  })
})
```

- [ ] **Step 2: 跑 parser 測試確認失敗**

Run: `bun test tests/commands/parse-ralph-loop-command.test.ts`
Expected: FAIL，因為目前 parser 不接受 `--max-iterations=` / `--completion-promise=`，也沒有 `strategy` 輸出欄位

- [ ] **Step 3: 最小擴充 parser，讓 canonical 與 legacy contract 共存**

```ts
type RalphLoopStrategy = "continue"

type RalphLoopStartCommand = {
  kind: "start"
  prompt: string
  maxIterations?: number
  completionPromise: string
  strategy: RalphLoopStrategy
}

// canonical:
// --max-iterations=7
// --completion-promise=SHIP
// --strategy=continue
// legacy aliases:
// --max 7
// --promise "SHIP"
```

- [ ] **Step 4: 更新 builtin command 文案，使 template、parser、runtime 預設一致**

```ts
const RALPH_LOOP_TEMPLATE = `
Parse the arguments below and begin working on the task. The format is:
\`task description [--completion-promise=TEXT] [--max-iterations=N] [--strategy=continue]\`

Default completion promise is "${DEFAULT_COMPLETION_PROMISE}".
Default max iterations comes from plugin config (fallback ${DEFAULT_MAX_ITERATIONS}).
`
```

- [ ] **Step 5: 補 plugin-level 測試，確認 formal command 仍正確導到 `tool.execute.before`**

Run: `bun test tests/plugin/plugin-integration.test.ts`
Expected: PASS，且 `createPlugin > starts the loop when /ralph-loop executes as a formal command` 改成驗證 canonical flag 也能正確進 core

- [ ] **Step 6: Commit**

```bash
git add src/plugin/command-definitions.ts src/commands/parse-ralph-loop-command.ts src/ralph-loop/constants.ts tests/commands/parse-ralph-loop-command.test.ts tests/plugin/plugin-integration.test.ts README.md
git commit -m "feat: align ralph loop command contract"
```

---

### Task 2: Add project-compatible Ralph Loop runtime config

**Files:**
- Create: `src/plugin/plugin-config.ts`
- Modify: `src/plugin/create-plugin.ts`
- Modify: `src/plugin/config-handler.ts`
- Modify: `src/ralph-loop/constants.ts`
- Modify: `src/ralph-loop/types.ts`
- Modify: `src/ralph-loop/loop-core.ts`
- Test: `tests/plugin/plugin-integration.test.ts`
- Test: `tests/ralph-loop/loop-core.test.ts`

- [ ] **Step 1: 寫失敗測試，鎖定 config 的三個責任**

```ts
it("registers commands only when ralph_loop.enabled is true", async () => {
  const plugin = await createPlugin(ctx)
  const config = {} as Record<string, unknown>

  await plugin.config(config)
  expect(config.command).toBeUndefined()

  await plugin.config({ ralph_loop: { enabled: true } } as any)
  // expect formal commands to be present
})

it("uses config default_max_iterations when command omits max", async () => {
  // plugin.config({ ralph_loop: { enabled: true, default_max_iterations: 12 } })
  // then /ralph-loop task should call startLoop(..., { maxIterations: 12, ... })
})
```

- [ ] **Step 2: 跑 plugin / core 測試確認失敗**

Run: `bun test tests/plugin/plugin-integration.test.ts tests/ralph-loop/loop-core.test.ts`
Expected: FAIL，因為目前沒有 runtime config 狀態，也沒有 default max fallback

- [ ] **Step 3: 建立專案版 plugin config module**

```ts
export type RalphLoopPluginConfig = {
  enabled: boolean
  defaultMaxIterations: number
  defaultStrategy: "continue"
}

export const DEFAULT_RALPH_LOOP_PLUGIN_CONFIG: RalphLoopPluginConfig = {
  enabled: false,
  defaultMaxIterations: 100,
  defaultStrategy: "continue",
}

export function resolveRalphLoopPluginConfig(input: unknown): RalphLoopPluginConfig {
  // read input.ralph_loop
  // validate enabled/default_max_iterations/default_strategy
  // reject reset; ignore state_dir
}
```

- [ ] **Step 4: 讓 `createPlugin` 持有 mutable resolved config，並讓 hooks 共用它**

```ts
let pluginConfig = DEFAULT_RALPH_LOOP_PLUGIN_CONFIG

return {
  config: async (input) => {
    pluginConfig = handleConfig(input)
  },
  "tool.execute.before": async (input, output) => {
    await handleToolExecuteBefore(input, output, core, pluginConfig)
  },
}
```

- [ ] **Step 5: 讓 `handleConfig` 同時做兩件事**

```ts
export async function handleConfig(input: Record<string, unknown>) {
  const pluginConfig = resolveRalphLoopPluginConfig(input)

  if (pluginConfig.enabled) {
    input.command = {
      ...getBuiltinCommands(pluginConfig),
      ...existingCommands,
    }
  }

  return pluginConfig
}
```

- [ ] **Step 6: 讓 loop core 套用 config default，而不是把 `undefined` 直接持久化**

```ts
const effectiveMaxIterations =
  options.maxIterations ?? deps.defaults.defaultMaxIterations

const effectiveStrategy =
  options.strategy ?? deps.defaults.defaultStrategy
```

- [ ] **Step 7: 跑目標測試，確認 disabled / enabled / default max 都成立**

Run: `bun test tests/plugin/plugin-integration.test.ts tests/ralph-loop/loop-core.test.ts`
Expected: PASS，且 disabled 時不註冊 command、不處理 loop；enabled 時會使用 config default

- [ ] **Step 8: Commit**

```bash
git add src/plugin/plugin-config.ts src/plugin/create-plugin.ts src/plugin/config-handler.ts src/ralph-loop/constants.ts src/ralph-loop/types.ts src/ralph-loop/loop-core.ts tests/plugin/plugin-integration.test.ts tests/ralph-loop/loop-core.test.ts
git commit -m "feat: add ralph loop runtime config"
```

---

### Task 3: Recover from orphaned loop state during unrelated idle events

**Files:**
- Modify: `src/ralph-loop/loop-core.ts`
- Test: `tests/ralph-loop/loop-core.test.ts`

- [ ] **Step 1: 寫失敗測試，鎖定 stale state 的兩個場景**

```ts
it("clears orphaned active state when an unrelated idle reveals the original session is gone", async () => {
  // state.session_id = "missing-session"
  // incoming idle sessionID = "different-session"
  // adapter.sessionExists("missing-session") => false
  // expect state cleared
})

it("keeps state when unrelated idle arrives but original session still exists", async () => {
  // adapter.sessionExists("active-session") => true
  // expect state preserved and no prompt injected
})
```

- [ ] **Step 2: 跑 loop-core 測試確認失敗**

Run: `bun test tests/ralph-loop/loop-core.test.ts`
Expected: FAIL，因為目前 `handleEvent()` 對 mismatched `session.idle` 直接 return，不會做 stale-state recovery

- [ ] **Step 3: 在 `session.idle` 分支加入 orphaned-state recovery**

```ts
const state = await readState(deps.rootDir)
if (!state || !state.active) return

if (state.session_id !== event.sessionID) {
  const stillExists = await deps.adapter.sessionExists(state.session_id)
  if (!stillExists) {
    await clearState(deps.rootDir)
  }
  return
}
```

- [ ] **Step 4: 確認 recovery 不會干擾既有 in-flight / incarnation guard**

Run: `bun test tests/ralph-loop/loop-core.test.ts`
Expected: PASS，既有 duplicate-idle、cancel/restart、in-flight guard 測試仍全綠

- [ ] **Step 5: Commit**

```bash
git add src/ralph-loop/loop-core.ts tests/ralph-loop/loop-core.test.ts
git commit -m "fix: recover orphaned ralph loop state"
```

---

### Task 4: Final regression and packaging verification

**Files:**
- Verify only

- [ ] **Step 1: 跑完整測試**

Run: `bun test`
Expected: PASS

- [ ] **Step 2: 跑型別檢查與建置**

Run: `bun run typecheck`
Expected: PASS

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: 若 README 有 command 說明，確認與 runtime contract 一致**

Check:
- canonical flags 與 parser 一致
- default max 來源描述為 plugin config fallback 100
- 不誤寫 `state_dir` 或 `.sisyphus`

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: align ralph loop docs with runtime behavior"
```

## Notes for Execution

- 不要把 reference 的 `state_dir` 帶進來；`just-loop` 的 state path 仍固定為 `.loop/ralph-loop.local.md`
- 如果 OpenCode config hook 的實際 lifecycle 與測試假設不同，優先以 `@opencode-ai/plugin` 現有型別與 runtime 行為為準，再調整 plugin-local config 持有方式
- `tool.execute.before` 仍是正式 command side effect 的主入口；不要用 `chat.message` 取代它
