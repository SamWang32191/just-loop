import { createOpenCodeHostAdapter } from "../host-adapter/opencode-host-adapter.js"
import type { OpenCodeHostAdapterContext } from "../host-adapter/types.js"
import { createLoopCore } from "../ralph-loop/loop-core.js"
import { handleChatMessage } from "./chat-message-handler.js"
import { handleEvent } from "./event-handler.js"
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

export type PluginHooks = {
  "chat.message": (input: ChatMessageInput, output: ChatMessageOutput) => Promise<void>
  event: (input: EventInput) => Promise<void>
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
  const core = createCore({ rootDir: ctx.directory, adapter })

  return {
    "chat.message": async (input: ChatMessageInput, output: ChatMessageOutput) => {
      const sessionID = extractSessionID(input)
      if (!sessionID) return

      await handleChatMessage(extractChatText(output.parts), core, sessionID)
    },
    event: async (input: EventInput) => {
      if (!input.event) return
      await handleEvent(input.event, core)
    },
  }
}
