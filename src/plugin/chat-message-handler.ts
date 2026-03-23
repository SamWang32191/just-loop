import { parseRalphLoopCommand } from "../commands/parse-ralph-loop-command.js"

type LoopCore = {
  startLoop: (sessionID: string, prompt: string, options: { maxIterations?: number; completionPromise?: string }) => Promise<unknown>
  cancelLoop: (sessionID: string) => Promise<unknown>
}

export async function handleChatMessage(input: string, core: LoopCore, sessionID: string) {
  if (typeof input !== "string") return

  const command = parseRalphLoopCommand(input)
  if (!command) return

  if (command.kind === "cancel") {
    await core.cancelLoop(sessionID)
    return
  }

  await core.startLoop(sessionID, command.prompt, {
    maxIterations: command.maxIterations,
    completionPromise: command.completionPromise,
  })
}
