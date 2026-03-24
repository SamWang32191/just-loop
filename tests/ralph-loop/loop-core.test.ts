import { afterEach, describe, expect, it, mock } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createOpenCodeHostAdapter } from "../../src/host-adapter/opencode-host-adapter"
import {
  DEFAULT_COMPLETION_PROMISE,
  DEFAULT_MAX_ITERATIONS_FALLBACK,
} from "../../src/ralph-loop/constants"
import { createLoopCore } from "../../src/ralph-loop/loop-core"
import { readState, writeState } from "../../src/ralph-loop/state-store"
import type { RalphLoopState } from "../../src/ralph-loop/types"

const createdRoots: string[] = []

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), "ralph-loop-core-"))
  createdRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("createOpenCodeHostAdapter", () => {
  it("extracts role and text from session.messages and prefers promptAsync", async () => {
    const messages = mock(async () => [
      {
        info: { role: "assistant" },
        parts: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "ping" }],
      },
    ])
    const promptAsync = mock(async () => undefined)
    const prompt = mock(async () => undefined)
    const abort = mock(async () => undefined)

    const adapter = createOpenCodeHostAdapter({
      directory: "/workspace",
      client: {
        session: { messages, promptAsync, prompt, abort },
      },
    })

    await expect(adapter.getMessageCount("s1")).resolves.toBe(2)
    await expect(adapter.getMessages("s1")).resolves.toEqual([
      { role: "assistant", text: "hello\nworld" },
      { role: "user", text: "ping" },
    ])

    await adapter.prompt("s1", "continue")
    expect(promptAsync).toHaveBeenCalledTimes(1)
    expect(prompt).not.toHaveBeenCalled()
    await expect(adapter.sessionExists("s1")).resolves.toBe(true)
    await adapter.abortSession("s1")
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it("supports wrapped session.messages responses", async () => {
    const messages = mock(async () => ({
      data: [
        {
          info: { role: "assistant" },
          parts: [{ type: "text", text: "wrapped hello" }],
        },
      ],
    }))
    const prompt = mock(async () => undefined)
    const abort = mock(async () => undefined)

    const adapter = createOpenCodeHostAdapter({
      directory: "/workspace",
      client: {
        session: { messages, prompt, abort },
      },
    })

    await expect(adapter.getMessageCount("s1")).resolves.toBe(1)
    await expect(adapter.getMessages("s1")).resolves.toEqual([
      { role: "assistant", text: "wrapped hello" },
    ])
  })

  it("distinguishes not-found from host failures", async () => {
    const notFoundError = Object.assign(new Error("missing"), { code: "ENOENT" })
    const hostError = new Error("host exploded")
    const notFoundMessages = mock(async () => {
      throw notFoundError
    })
    const failingMessages = mock(async () => {
      throw hostError
    })
    const prompt = mock(async () => undefined)
    const abort = mock(async () => undefined)

    const notFoundAdapter = createOpenCodeHostAdapter({
      directory: "/workspace",
      client: {
        session: { messages: notFoundMessages, prompt, abort },
      },
    })

    const failingAdapter = createOpenCodeHostAdapter({
      directory: "/workspace",
      client: {
        session: { messages: failingMessages, prompt, abort },
      },
    })

    await expect(notFoundAdapter.sessionExists("missing")).resolves.toBe(false)
    await expect(failingAdapter.sessionExists("boom")).rejects.toThrow("host exploded")
    await expect(failingAdapter.getMessageCount("boom")).rejects.toThrow("host exploded")
    await expect(failingAdapter.getMessages("boom")).rejects.toThrow("host exploded")
    await notFoundAdapter.prompt("s1", "continue")
    expect(prompt).toHaveBeenCalledTimes(1)
  })
})

describe("loop-core", () => {
  it("continues when completion is not found and persists message count and promise", async () => {
    const root = await createRoot()
    const getMessageCount = mock(async () => 5)
    const getMessages = mock(async () => [
      { role: "assistant", text: "still working" },
      { role: "assistant", text: "more work" },
      { role: "assistant", text: "more work 2" },
      { role: "assistant", text: "more work 3" },
      { role: "assistant", text: "more work 4" },
      { role: "assistant", text: "more work 5" },
    ])
    const prompt = mock(async (_sessionID: string, text: string) => {
      expect(text).toContain("Continue Ralph Loop iteration 1.")
      expect(text).toContain("Max iterations: 3")
      expect(text).toContain(DEFAULT_COMPLETION_PROMISE)
    })
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: { getMessageCount, getMessages, prompt, sessionExists, abortSession },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    const started = await readState(root)
    expect(started?.message_count_at_start).toBe(5)
    expect(started?.completion_promise).toBe(DEFAULT_COMPLETION_PROMISE)

    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    const state = await readState(root)
    expect(state?.active).toBe(true)
    expect(state?.iteration).toBe(1)
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("uses configured default max iterations when startLoop omits maxIterations", async () => {
    const root = await createRoot()
    const getMessageCount = mock(async () => 0)
    const getMessages = mock(async () => [{ role: "assistant", text: "still working" }])
    const prompt = mock(async (_sessionID: string, text: string) => {
      expect(text).toContain("Max iterations: 7")
    })
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: { getMessageCount, getMessages, prompt, sessionExists, abortSession },
      getConfig: () => ({
        enabled: true,
        defaultMaxIterations: 7,
        defaultStrategy: "continue",
      }),
    })

    await core.startLoop("s1", "build plugin")

    const started = await readState(root)
    expect(started?.max_iterations).toBe(7)

    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("falls back to the project default max iterations when runtime config omits it", async () => {
    const root = await createRoot()
    const getMessageCount = mock(async () => 0)
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount,
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt: mock(async () => undefined),
        sessionExists,
        abortSession,
      },
    })

    await core.startLoop("s1", "build plugin")

    expect((await readState(root))?.max_iterations).toBe(DEFAULT_MAX_ITERATIONS_FALLBACK)
  })

  it("clears state when completion is found", async () => {
    const root = await createRoot()
    const getMessageCount = mock(async () => 0)
    const getMessages = mock(async () => [
      { role: "assistant", text: "still working" },
      { role: "assistant", text: DEFAULT_COMPLETION_PROMISE },
    ])
    const prompt = mock(async () => undefined)
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: { getMessageCount, getMessages, prompt, sessionExists, abortSession },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(await readState(root)).toBeNull()
    expect(prompt).not.toHaveBeenCalled()
  })

  it("stops when max iterations are reached", async () => {
    const root = await createRoot()
    const getMessages = mock(async () => [{ role: "assistant", text: "still working" }])
    const prompt = mock(async () => undefined)
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages,
        prompt,
        sessionExists,
        abortSession,
      },
    })

    const state: RalphLoopState = {
      active: true,
      session_id: "s1",
      prompt: "build plugin",
      iteration: 3,
      max_iterations: 3,
      completion_promise: DEFAULT_COMPLETION_PROMISE,
      message_count_at_start: 0,
      started_at: "2026-03-23T00:00:00.000Z",
    }
    await writeState(root, state)

    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(await readState(root)).toBeNull()
    expect(prompt).not.toHaveBeenCalled()
  })

  it("aborts the session and clears state on cancel", async () => {
    const root = await createRoot()
    const getMessageCount = mock(async () => 0)
    const getMessages = mock(async () => [{ role: "assistant", text: "still working" }])
    const prompt = mock(async () => undefined)
    const sessionExists = mock(async () => true)
    const abortSession = mock(async () => undefined)

    const core = createLoopCore({
      rootDir: root,
      adapter: { getMessageCount, getMessages, prompt, sessionExists, abortSession },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.cancelLoop("s1")

    expect(abortSession).toHaveBeenCalledTimes(1)
    expect(await readState(root)).toBeNull()
  })

  it("clears state on session.deleted", async () => {
    const root = await createRoot()
    const prompt = mock(async () => undefined)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.deleted", sessionID: "s1" })

    expect(await readState(root)).toBeNull()
    expect(prompt).not.toHaveBeenCalled()
  })

  it("clears state on session.error", async () => {
    const root = await createRoot()
    const prompt = mock(async () => undefined)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.error", sessionID: "s1" })

    expect(await readState(root)).toBeNull()
    expect(prompt).not.toHaveBeenCalled()
  })

  it("clears state on deleted/error even while idle is in flight", async () => {
    const root = await createRoot()
    let resolvePrompt!: () => void
    let signalPromptStarted!: () => void
    const promptStarted = new Promise<void>((resolve) => {
      signalPromptStarted = resolve
    })
    const prompt = mock(() => {
      signalPromptStarted()
      return new Promise<void>((resolve) => {
        resolvePrompt = resolve
      })
    })
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })

    const idle = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await promptStarted
    await core.handleEvent({ type: "session.deleted", sessionID: "s1" })
    resolvePrompt()
    await idle

    expect(await readState(root)).toBeNull()

    let resolvePrompt2!: () => void
    let signalPromptStarted2!: () => void
    const promptStarted2 = new Promise<void>((resolve) => {
      signalPromptStarted2 = resolve
    })
    const prompt2 = mock(() => {
      signalPromptStarted2()
      return new Promise<void>((resolve) => {
        resolvePrompt2 = resolve
      })
    })
    const core2 = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt: prompt2,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core2.startLoop("s2", "build plugin", { maxIterations: 3 })
    const idle2 = core2.handleEvent({ type: "session.idle", sessionID: "s2" })
    await promptStarted2
    await core2.handleEvent({ type: "session.error", sessionID: "s2" })
    resolvePrompt2()
    await idle2

    expect(await readState(root)).toBeNull()
  })

  it("does not advance iteration when prompt injection fails", async () => {
    const root = await createRoot()
    const prompt = mock(async () => {
      throw new Error("prompt failed")
    })
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await expect(core.handleEvent({ type: "session.idle", sessionID: "s1" })).rejects.toThrow(
      "prompt failed",
    )

    const state = await readState(root)
    expect(state?.iteration).toBe(0)
  })

  it("does not prompt if deleted during idle processing after messages are read", async () => {
    const root = await createRoot()
    const prompt = mock(async () => undefined)
    let core!: ReturnType<typeof createLoopCore>

    const getMessages = mock(async () => {
      await core.handleEvent({ type: "session.deleted", sessionID: "s1" })
      return [{ role: "assistant", text: "still working" }]
    })

    core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(prompt).not.toHaveBeenCalled()
    expect(await readState(root)).toBeNull()
  })

  it("does not repeat continuation for the same message set across consecutive idles", async () => {
    const root = await createRoot()
    const getMessages = mock(async () => [
      { role: "assistant", text: "still working" },
      { role: "assistant", text: "more work" },
    ])
    const prompt = mock(async () => undefined)
    const getMessageCount = mock(async () => 1)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount,
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(prompt).toHaveBeenCalledTimes(1)
    expect((await readState(root))?.iteration).toBe(1)
  })

  it("does not continue when the only new message is its own continuation prompt", async () => {
    const root = await createRoot()
    let batch = 0
    const getMessages = mock(async () => {
      batch += 1
      return batch === 1
        ? [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
            { role: "assistant", text: "more work 2" },
          ]
        : [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
            { role: "assistant", text: "more work 2" },
            { role: "user", text: "Continue Ralph Loop iteration 1." },
          ]
    })
    const prompt = mock(async () => undefined)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => (batch === 0 ? 2 : 4)),
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(prompt).toHaveBeenCalledTimes(1)
    expect((await readState(root))?.iteration).toBe(1)
  })

  it("does not continue on first idle when no new messages exist", async () => {
    const root = await createRoot()
    const getMessages = mock(async () => [{ role: "assistant", text: "still working" }])
    const prompt = mock(async () => undefined)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 1),
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    expect(prompt).not.toHaveBeenCalled()
    const state = await readState(root)
    expect(state?.iteration).toBe(0)
    expect(state?.last_message_count_processed).toBeUndefined()
  })

  it("keeps restarted state when an old idle finishes after cancel", async () => {
    const root = await createRoot()
    let resolvePrompt!: () => void
    let signalPromptStarted!: () => void
    const promptStarted = new Promise<void>((resolve) => {
      signalPromptStarted = resolve
    })
    let startCount = 0
    let messageBatchIndex = 0
    const prompt = mock(() => {
      signalPromptStarted()
      return new Promise<void>((resolve) => {
        resolvePrompt = resolve
      })
    })
    const getMessageCount = mock(async () => (startCount++ === 0 ? 1 : 2))
    const getMessages = mock(async () => {
      messageBatchIndex += 1
      return messageBatchIndex === 1
        ? [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
          ]
        : [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
            { role: "assistant", text: "more work again" },
          ]
    })
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount,
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })

    const idle = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await promptStarted
    await core.cancelLoop("s1")
    await core.startLoop("s1", "rebuild plugin", { maxIterations: 4 })
    resolvePrompt()
    await idle

    const state = await readState(root)
    expect(state?.session_id).toBe("s1")
    expect(state?.prompt).toBe("rebuild plugin")
    expect(state?.iteration).toBe(0)
  })

  it("processes a new incarnation idle even while the old one is still in flight", async () => {
    const root = await createRoot()
    let resolveFirstPrompt!: () => void
    let resolveSecondPrompt!: () => void
    let signalFirstPromptStarted!: () => void
    let signalSecondPromptStarted!: () => void
    const firstPromptStarted = new Promise<void>((resolve) => {
      signalFirstPromptStarted = resolve
    })
    const secondPromptStarted = new Promise<void>((resolve) => {
      signalSecondPromptStarted = resolve
    })
    let promptCalls = 0
    let startCount = 0
    let messageBatchIndex = 0
    const prompt = mock(() => {
      promptCalls += 1
      if (promptCalls === 1) {
        signalFirstPromptStarted()
        return new Promise<void>((resolve) => {
          resolveFirstPrompt = resolve
        })
      }

      signalSecondPromptStarted()
      return new Promise<void>((resolve) => {
        resolveSecondPrompt = resolve
      })
    })
    const getMessages = mock(async () => {
      messageBatchIndex += 1
      return messageBatchIndex === 1
        ? [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
          ]
        : [
            { role: "assistant", text: "still working" },
            { role: "assistant", text: "more work" },
            { role: "assistant", text: "more work again" },
          ]
    })
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => (startCount++ === 0 ? 1 : 2)),
        getMessages,
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })
    const firstIdle = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await firstPromptStarted
    await core.cancelLoop("s1")
    await core.startLoop("s1", "rebuild plugin", { maxIterations: 4 })
    const secondIdle = core.handleEvent({ type: "session.idle", sessionID: "s1" })

    await secondPromptStarted
    resolveSecondPrompt()
    await secondIdle
    resolveFirstPrompt()
    await firstIdle

    expect(prompt).toHaveBeenCalledTimes(2)
    const state = await readState(root)
    expect(state?.session_id).toBe("s1")
    expect(state?.prompt).toBe("rebuild plugin")
    expect(state?.iteration).toBe(1)
  })

  it("recovers from stale state before starting a new loop", async () => {
    const root = await createRoot()
    const sessionExists = mock(async (sessionID: string) => sessionID !== "stale-session")
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 9),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt: mock(async () => undefined),
        sessionExists,
        abortSession: mock(async () => undefined),
      },
    })

    await writeState(root, {
      active: true,
      session_id: "stale-session",
      prompt: "old task",
      iteration: 2,
      max_iterations: 3,
      completion_promise: DEFAULT_COMPLETION_PROMISE,
      message_count_at_start: 1,
      started_at: "2026-03-23T00:00:00.000Z",
    })

    await core.startLoop("fresh-session", "build plugin", { maxIterations: 4 })

    expect(sessionExists).toHaveBeenCalledWith("stale-session")
    expect((await readState(root))?.session_id).toBe("fresh-session")
  })

  it("rejects a second active loop while the current session still exists", async () => {
    const root = await createRoot()
    const sessionExists = mock(async () => true)
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt: mock(async () => undefined),
        sessionExists,
        abortSession: mock(async () => undefined),
      },
    })

    await writeState(root, {
      active: true,
      session_id: "existing-session",
      prompt: "old task",
      iteration: 1,
      max_iterations: 3,
      completion_promise: DEFAULT_COMPLETION_PROMISE,
      message_count_at_start: 1,
      started_at: "2026-03-23T00:00:00.000Z",
    })

    await expect(core.startLoop("fresh-session", "build plugin", { maxIterations: 4 })).rejects.toThrow(
      "an active Ralph Loop already exists; use /cancel-ralph first",
    )
  })

  it("guards against duplicate idle events while a continuation is in flight", async () => {
    const root = await createRoot()
    let resolvePrompt!: () => void
    const prompt = mock(() => new Promise<void>((resolve) => {
      resolvePrompt = resolve
    }))
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3 })

    const first = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    const second = core.handleEvent({ type: "session.idle", sessionID: "s1" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    resolvePrompt()
    await Promise.all([first, second])

    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it("persists a custom completion promise and includes it in the continuation prompt", async () => {
    const root = await createRoot()
    const customPromise = "<promise>SHIP</promise>"
    const prompt = mock(async (_sessionID: string, text: string) => {
      expect(text).toContain(customPromise)
    })
    const core = createLoopCore({
      rootDir: root,
      adapter: {
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => [{ role: "assistant", text: "still working" }]),
        prompt,
        sessionExists: mock(async () => true),
        abortSession: mock(async () => undefined),
      },
    })

    await core.startLoop("s1", "build plugin", { maxIterations: 3, completionPromise: customPromise })
    await core.handleEvent({ type: "session.idle", sessionID: "s1" })

    const state = await readState(root)
    expect(state?.completion_promise).toBe(customPromise)
    expect(prompt).toHaveBeenCalledTimes(1)
  })
})
