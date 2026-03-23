import type { HostAdapter, OpenCodeHostAdapterContext } from "./types.js"

type RawMessageRecord = {
  info?: { role?: unknown }
  parts?: Array<{ type?: unknown; text?: unknown }>
}

function buildSessionInput(directory: string, sessionID: string) {
  return {
    sessionID,
    directory,
  }
}

function buildPromptInput(directory: string, sessionID: string, text: string) {
  return {
    sessionID,
    directory,
    parts: [{ type: "text" as const, text }],
  }
}

function extractMessages(response: unknown) {
  const records = Array.isArray(response)
    ? response
    : response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)
      ? ((response as { data: unknown }).data as unknown[])
      : []

  return records.map((item) => {
    const record = item as RawMessageRecord
    const role = typeof record.info?.role === "string" ? record.info.role : "unknown"
    const text = Array.isArray(record.parts)
      ? record.parts
          .filter((part) => part.type === "text" && typeof part.text === "string")
          .map((part) => part.text)
          .join("\n")
      : ""

    return { role, text }
  })
}

function isNotFoundError(error: unknown) {
  if (!(error instanceof Error)) return false

  const record = error as Error & { code?: unknown; status?: unknown }
  return (
    record.code === "ENOENT" ||
    record.status === 404 ||
    error.message.toLowerCase().includes("not found") ||
    error.message.toLowerCase().includes("missing")
  )
}

export function createOpenCodeHostAdapter(ctx: OpenCodeHostAdapterContext): HostAdapter {
  return {
    async getMessageCount(sessionID) {
      const response = await ctx.client.session.messages(buildSessionInput(ctx.directory, sessionID))
      if (Array.isArray(response)) return response.length
      if (response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)) {
        return (response as { data: unknown[] }).data.length
      }

      return 0
    },
    async getMessages(sessionID) {
      const response = await ctx.client.session.messages(buildSessionInput(ctx.directory, sessionID))
      return extractMessages(response)
    },
    async prompt(sessionID, text) {
      const input = buildPromptInput(ctx.directory, sessionID, text)
      if (ctx.client.session.promptAsync) {
        await ctx.client.session.promptAsync(input)
        return
      }

      await ctx.client.session.prompt(input)
    },
    async abortSession(sessionID) {
      await ctx.client.session.abort({ sessionID, directory: ctx.directory })
    },
    async sessionExists(sessionID) {
      try {
        await ctx.client.session.messages(buildSessionInput(ctx.directory, sessionID))
        return true
      } catch (error) {
        if (isNotFoundError(error)) {
          return false
        }

        throw error
      }
    },
  }
}
