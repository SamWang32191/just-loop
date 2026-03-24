import { createOpenCodeHostAdapter } from "../host-adapter/opencode-host-adapter.js"
import type { OpenCodeHostAdapterContext } from "../host-adapter/types.js"
import { parseRalphLoopCommand } from "../commands/parse-ralph-loop-command.js"
import { createLoopCore } from "../ralph-loop/loop-core.js"
import type { RalphLoopRuntimeConfig } from "../ralph-loop/types.js"
import { handleConfig } from "./config-handler.js"
import { handleEvent } from "./event-handler.js"
import { resolvePluginConfig } from "./plugin-config.js"
import type { Plugin } from "@opencode-ai/plugin"

export type CreatePluginDeps = {
  createOpenCodeHostAdapter?: typeof createOpenCodeHostAdapter
  createLoopCore?: typeof createLoopCore
}

type PluginInput = Parameters<Plugin>[0]

type TextPart = { type?: unknown; text?: unknown }

type ChatMessageInput = {
  sessionID?: unknown
  properties?: { sessionID?: unknown }
  path?: { id?: unknown }
}

type ChatMessageOutput = {
  parts?: Array<TextPart>
}

type EventInput = {
  event?: unknown
}

type ToolExecuteBeforeInput = {
  tool?: unknown
  sessionID?: unknown
  callID?: unknown
}

type ToolExecuteBeforeOutput = {
  args?: {
    name?: unknown
  }
}

export type PluginHooks = {
  "chat.message": (input: ChatMessageInput, output: ChatMessageOutput) => Promise<void>
  event: (input: EventInput) => Promise<void>
  config: (input: Record<string, unknown>) => Promise<void>
  "tool.execute.before": (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => Promise<void>
}

function extractSessionID(input: ChatMessageInput) {
  if (typeof input.sessionID === "string") return input.sessionID
  if (typeof input.properties?.sessionID === "string") return input.properties.sessionID
  if (typeof input.path?.id === "string") return input.path.id
  return null
}

function extractChatText(parts: Array<TextPart> | undefined) {
  return (parts ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

export async function createPlugin(
  ctx?: PluginInput,
  deps: CreatePluginDeps = {},
): Promise<PluginHooks> {
  if (!ctx) throw new Error("plugin context is required")

  const createAdapter = deps.createOpenCodeHostAdapter ?? createOpenCodeHostAdapter
  const createCore = deps.createLoopCore ?? createLoopCore
  let resolvedConfig: RalphLoopRuntimeConfig = resolvePluginConfig({})
  const adapter = createAdapter({
    directory: ctx.directory,
    client: {
      session: {
        messages: async ({ sessionID, directory }) =>
          ctx.client.session.messages({ path: { id: sessionID }, query: { directory } }),
        promptAsync: ctx.client.session.promptAsync
          ? async ({ sessionID, directory, parts }) =>
              ctx.client.session.promptAsync?.({ path: { id: sessionID }, body: { parts }, query: { directory } })
          : undefined,
        prompt: async ({ sessionID, directory, parts }) =>
          ctx.client.session.prompt({ path: { id: sessionID }, body: { parts }, query: { directory } }),
        abort: async ({ sessionID }) => ctx.client.session.abort({ path: { id: sessionID } }),
      },
    },
  } satisfies OpenCodeHostAdapterContext)
  const core = createCore({
    rootDir: ctx.directory,
    adapter,
    getConfig: () => resolvedConfig,
  })

  return {
    config: async (input: Record<string, unknown>) => {
      resolvedConfig = await handleConfig(input)
    },
    "chat.message": async (input: ChatMessageInput, output: ChatMessageOutput) => {
      const sessionID = extractSessionID(input)
      if (!sessionID) return
      extractChatText(output.parts)
    },
    event: async (input: EventInput) => {
      if (!resolvedConfig.enabled) return
      if (!input.event) return
      await handleEvent(input.event, core)
    },
    "tool.execute.before": async (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => {
      if (!resolvedConfig.enabled) return
      if (input.tool !== "skill") return
      if (typeof input.sessionID !== "string") return
      if (typeof output.args?.name !== "string") return

      const normalizedCommand = output.args.name.startsWith("/") ? output.args.name : `/${output.args.name}`
      const command = parseRalphLoopCommand(normalizedCommand)
      if (!command) return

      if (command.kind === "cancel") {
        await core.cancelLoop(input.sessionID)
        return
      }

      await core.startLoop(input.sessionID, command.prompt, {
        maxIterations: command.maxIterations ?? resolvedConfig.defaultMaxIterations,
        completionPromise: command.completionPromise,
      })
    },
  }
}
