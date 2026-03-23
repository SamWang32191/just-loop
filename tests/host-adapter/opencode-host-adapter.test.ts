import { describe, expect, it, mock } from "bun:test"
import { createOpenCodeHostAdapter } from "../../src/host-adapter/opencode-host-adapter"

describe("createOpenCodeHostAdapter", () => {
  it("uses flattened v2 SDK params for messages, prompt, and abort", async () => {
    const messages = mock(async () => [
      {
        info: { role: "assistant" },
        parts: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
      },
    ])
    const promptAsync = mock(async () => undefined)
    const abort = mock(async () => undefined)

    const adapter = createOpenCodeHostAdapter({
      directory: "/workspace",
      client: {
        session: { messages, promptAsync, abort, prompt: mock(async () => undefined) },
      },
    })

    await adapter.getMessageCount("s1")
    await adapter.getMessages("s1")
    await adapter.prompt("s1", "continue")
    await adapter.abortSession("s1")

    expect(messages).toHaveBeenNthCalledWith(1, { sessionID: "s1", directory: "/workspace" })
    expect(promptAsync).toHaveBeenCalledWith({
      sessionID: "s1",
      directory: "/workspace",
      parts: [{ type: "text", text: "continue" }],
    })
    expect(abort).toHaveBeenCalledWith({ sessionID: "s1", directory: "/workspace" })
  })
})
