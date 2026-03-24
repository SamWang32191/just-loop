import { describe, expect, it, mock } from "bun:test"
import { createPlugin } from "../../src/plugin/create-plugin"
import { handleChatMessage } from "../../src/plugin/chat-message-handler"
import { handleEvent } from "../../src/plugin/event-handler"
import {
  DEFAULT_COMPLETION_PROMISE,
  DEFAULT_MAX_ITERATIONS_FALLBACK,
} from "../../src/ralph-loop/constants"

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

  it("wires canonical equals-style /ralph-loop flags to startLoop with parsed options", async () => {
    const startLoop = mock(async () => undefined)
    const cancelLoop = mock(async () => undefined)

    await handleChatMessage("/ralph-loop --max-iterations=7 --completion-promise=SHIP --strategy=continue task", {
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

  it("does not route raw slash text from chat.message through the real plugin hook", async () => {
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

    expect(startLoop).not.toHaveBeenCalled()
    expect(cancelLoop).not.toHaveBeenCalled()
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

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
      },
    } as any)

    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "call-3",
      } as any,
      {
        args: {
          name: "/ralph-loop build plugin",
        },
      } as any,
    )
    await plugin.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } } as any)

    expect(createOpenCodeHostAdapter).toHaveBeenCalledTimes(1)
    expect(createLoopCore).toHaveBeenCalledTimes(1)
    expect(core.startLoop).toHaveBeenCalledWith("s1", "build plugin", {
      maxIterations: DEFAULT_MAX_ITERATIONS_FALLBACK,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
    expect(core.handleEvent).toHaveBeenCalledWith({ type: "session.idle", sessionID: "s1" })
  })

  it("does not start the loop from raw slash text in chat.message", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin["chat.message"](
      { sessionID: "s1" } as any,
      { parts: [{ type: "text", text: "/ralph-loop build plugin" }] } as any,
    )

    expect(core.startLoop).not.toHaveBeenCalled()
    expect(core.cancelLoop).not.toHaveBeenCalled()
  })

  it("registers formal ralph-loop and cancel-ralph commands in config", async () => {
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
    expect(commands["ralph-loop"]).toBeDefined()
    expect(commands["ralph-loop"]?.description).toContain("Start self-referential development loop")
    expect(commands["ralph-loop"]?.template).toContain("You are starting a Ralph Loop")
    expect(commands["ralph-loop"]?.template).toContain("--max-iterations=N")
    expect(commands["ralph-loop"]?.template).toContain("--completion-promise=TEXT")
    expect(commands["ralph-loop"]?.template).toContain("--strategy=continue")
    expect(commands["cancel-ralph"]).toBeDefined()
    expect(commands["cancel-ralph"]?.description).toContain("Cancel active Ralph Loop")
    expect(commands["cancel-ralph"]?.template).toContain("Cancel the currently active Ralph Loop")
  })

  it("does not register commands or runtime side effects when ralph_loop is disabled", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    const config: Record<string, unknown> = {
      ralph_loop: {
        enabled: false,
      },
    }
    await plugin.config?.(config as any)
    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "session-disabled",
        callID: "call-disabled",
      } as any,
      {
        args: {
          name: "/ralph-loop build plugin",
        },
      } as any,
    )
    await plugin.event({ event: { type: "session.idle", properties: { sessionID: "session-disabled" } } } as any)

    expect(config.command).toEqual({})
    expect(core.startLoop).not.toHaveBeenCalled()
    expect(core.cancelLoop).not.toHaveBeenCalled()
    expect(core.handleEvent).not.toHaveBeenCalled()
  })

  it("keeps ralph_loop disabled when enabled is omitted", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    const config: Record<string, unknown> = {
      ralph_loop: {
        default_max_iterations: 7,
      },
    }
    await plugin.config?.(config as any)
    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "session-implicit-disabled",
        callID: "call-implicit-disabled",
      } as any,
      {
        args: {
          name: "/ralph-loop build plugin",
        },
      } as any,
    )

    expect(config.command).toEqual({})
    expect(core.startLoop).not.toHaveBeenCalled()
    expect(core.cancelLoop).not.toHaveBeenCalled()
    expect(core.handleEvent).not.toHaveBeenCalled()
  })

  it("rejects invalid top-level ralph_loop config values", async () => {
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

    await expect(plugin.config?.({ ralph_loop: false } as any)).rejects.toThrow(
      "ralph_loop must be an object",
    )
    await expect(plugin.config?.({ ralph_loop: "off" } as any)).rejects.toThrow(
      "ralph_loop must be an object",
    )
  })

  it("starts the loop when /ralph-loop executes as a formal command", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
      },
    } as any)

    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "session-command",
        callID: "call-1",
      } as any,
      {
        args: {
          name: "/ralph-loop --max 4 build plugin",
        },
      } as any,
    )

    expect(core.startLoop).toHaveBeenCalledWith("session-command", "build plugin", {
      maxIterations: 4,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
    expect(core.cancelLoop).not.toHaveBeenCalled()
  })

  it("starts the loop from command.execute.before for formally registered commands", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
      },
    } as any)

    await plugin["command.execute.before"]?.(
      {
        command: "ralph-loop",
        sessionID: "session-command-hook",
        arguments: "--max 6 build plugin",
      } as any,
      {
        parts: [],
      } as any,
    )

    expect(core.startLoop).toHaveBeenCalledWith("session-command-hook", "build plugin", {
      maxIterations: 6,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
    expect(core.cancelLoop).not.toHaveBeenCalled()
  })

  it("uses configured default max iterations when /ralph-loop omits --max", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
        default_max_iterations: 7,
      },
    } as any)
    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "session-default-max",
        callID: "call-default-max",
      } as any,
      {
        args: {
          name: "/ralph-loop build plugin",
        },
      } as any,
    )

    expect(core.startLoop).toHaveBeenCalledWith("session-default-max", "build plugin", {
      maxIterations: 7,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("cancels the loop when /cancel-ralph executes as a formal command", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
      },
    } as any)

    await plugin["tool.execute.before"]?.(
      {
        tool: "skill",
        sessionID: "session-command",
        callID: "call-2",
      } as any,
      {
        args: {
          name: "/cancel-ralph",
        },
      } as any,
    )

    expect(core.cancelLoop).toHaveBeenCalledWith("session-command")
    expect(core.startLoop).not.toHaveBeenCalled()
  })

  it("cancels the loop from command.execute.before for formally registered commands", async () => {
    const core = {
      startLoop: mock(async () => undefined),
      cancelLoop: mock(async () => undefined),
      handleEvent: mock(async () => undefined),
    }

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
        createLoopCore: mock(() => core as any),
      },
    )

    await plugin.config?.({
      ralph_loop: {
        enabled: true,
      },
    } as any)

    await plugin["command.execute.before"]?.(
      {
        command: "cancel-ralph",
        sessionID: "session-command-hook-cancel",
        arguments: "",
      } as any,
      {
        parts: [],
      } as any,
    )

    expect(core.cancelLoop).toHaveBeenCalledWith("session-command-hook-cancel")
    expect(core.startLoop).not.toHaveBeenCalled()
  })
})
