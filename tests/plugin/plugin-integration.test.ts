import { describe, expect, it, mock } from "bun:test"
import { createPlugin } from "../../src/plugin/create-plugin"
import { handleChatMessage } from "../../src/plugin/chat-message-handler"
import { handleEvent } from "../../src/plugin/event-handler"
import { DEFAULT_COMPLETION_PROMISE } from "../../src/ralph-loop/constants"

describe("plugin handlers", () => {
  it("wires /ralph-loop to startLoop with parsed options", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    await handleChatMessage("/ralph-loop --max 4 --promise \"<promise>SHIP</promise>\" build plugin", {
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

  it("wires /cancel-ralph to cancelLoop", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    await handleChatMessage("/cancel-ralph", { startLoop, cancelLoop } as any, "session-2")

    expect(cancelLoop).toHaveBeenCalledTimes(1)
    expect(cancelLoop).toHaveBeenCalledWith("session-2")
    expect(startLoop).not.toHaveBeenCalled()
  })

  it("ignores plain chat and unrelated commands", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    await handleChatMessage("hello world", { startLoop, cancelLoop } as any, "session-3")
    await handleChatMessage("/ralph-loopx task", { startLoop, cancelLoop } as any, "session-3")

    expect(startLoop).not.toHaveBeenCalled()
    expect(cancelLoop).not.toHaveBeenCalled()
  })

  it("extracts text from output.parts through the real plugin hook", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    const plugin = await createPlugin({
      directory: "/workspace",
      client: {
        session: {
          messages: mock(async () => []),
          promptAsync: mock(async () => undefined),
          prompt: mock(async () => undefined),
          abort: mock(async () => undefined),
        },
      },
    } as any, {
      createOpenCodeHostAdapter: mock(() => ({
        getMessageCount: mock(async () => 0),
        getMessages: mock(async () => []),
        prompt: mock(async () => undefined),
        abortSession: mock(async () => undefined),
        sessionExists: mock(async () => true),
      }) as any),
      createLoopCore: mock(() => ({ startLoop, cancelLoop, handleEvent: mock(async () => undefined) } as any)),
    })

    await plugin["chat.message"](
      { sessionID: "session-4" } as any,
      {
        parts: [
          { type: "text", text: "/ralph-loop build" },
          { type: "text", text: " plugin" },
          { type: "image", text: "ignored" },
        ],
      } as any,
    )

    expect(startLoop).toHaveBeenCalledTimes(1)
    expect(startLoop).toHaveBeenCalledWith("session-4", "build plugin", {
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("does not accept the legacy input.output shape", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    await import("../../src/plugin/chat-message-handler").then(async ({ handleChatMessage }) => {
      await (handleChatMessage as any)(
        {
          output: { parts: [{ type: "text", text: "/ralph-loop build plugin" }] },
        } as any,
        { parts: [{ type: "text", text: "/ralph-loop build plugin" }] } as any,
        { startLoop, cancelLoop } as any,
        "session-legacy",
      )
    })

    expect(startLoop).not.toHaveBeenCalled()
    expect(cancelLoop).not.toHaveBeenCalled()
  })

  it("routes idle/deleted/error events and ignores others", async () => {
    const handleLoopEvent = mock(async () => undefined)

    await handleEvent({ type: "session.idle", properties: { sessionID: "s1" } } as any, {
      handleEvent: handleLoopEvent,
    } as any)
    await handleEvent({ type: "session.deleted", properties: { info: { id: "s2" } } } as any, {
      handleEvent: handleLoopEvent,
    } as any)
    await handleEvent({ type: "session.error", properties: { sessionID: "s3" } } as any, {
      handleEvent: handleLoopEvent,
    } as any)
    await handleEvent({ type: "session.running", properties: { sessionID: "s4" } } as any, {
      handleEvent: handleLoopEvent,
    } as any)

    expect((handleLoopEvent as any).mock.calls).toEqual([
      [{ type: "session.idle", sessionID: "s1" }],
      [{ type: "session.deleted", sessionID: "s2" }],
      [{ type: "session.error", sessionID: "s3" }],
    ])
  })
})

describe("createPlugin", () => {
  it("connects the handler shell to core and adapter factories", async () => {
    const adapter = { kind: "adapter" } as any
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }
    const createOpenCodeHostAdapter = mock(() => adapter)
    const createLoopCore = mock(() => core)

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
        createOpenCodeHostAdapter,
        createLoopCore,
      },
    )

    await plugin["chat.message"](
      { sessionID: "s1" } as any,
      { parts: [{ type: "text", text: "/ralph-loop build" }, { type: "text", text: " plugin" }] } as any,
    )
    await plugin.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } } as any)

    expect(createOpenCodeHostAdapter).toHaveBeenCalledTimes(1)
    expect(createLoopCore).toHaveBeenCalledTimes(1)
    expect(core.startLoop).toHaveBeenCalledWith("s1", "build plugin", {
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
    expect(core.handleEvent).toHaveBeenCalledWith({ type: "session.idle", sessionID: "s1" })
  })
})
