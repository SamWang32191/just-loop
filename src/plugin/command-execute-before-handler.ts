import { parseRalphLoopCommand } from "../commands/parse-ralph-loop-command.js"

type LoopCore = {
  startLoop: (sessionID: string, prompt: string, options: { maxIterations?: number; completionPromise?: string }) => Promise<unknown>
  cancelLoop: (sessionID: string) => Promise<unknown>
}

type CommandExecuteBeforeInput = {
  command?: unknown
  sessionID?: unknown
  arguments?: unknown
}

type CommandExecuteBeforeOptions = {
  defaultMaxIterations?: number
}

function buildCommandLine(command: string, args: string) {
  const normalized = command.startsWith("/") ? command : `/${command}`
  const trimmedArgs = args.trim()
  return trimmedArgs.length > 0 ? `${normalized} ${trimmedArgs}` : normalized
}

export async function handleCommandExecuteBefore(
  input: CommandExecuteBeforeInput,
  core: LoopCore,
  options: CommandExecuteBeforeOptions = {},
) {
  if (typeof input.command !== "string") return
  if (typeof input.sessionID !== "string") return

  const args = typeof input.arguments === "string" ? input.arguments : ""
  const command = parseRalphLoopCommand(buildCommandLine(input.command, args))
  if (!command) return

  if (command.kind === "cancel") {
    await core.cancelLoop(input.sessionID)
    return
  }

  await core.startLoop(input.sessionID, command.prompt, {
    maxIterations: command.maxIterations ?? options.defaultMaxIterations,
    completionPromise: command.completionPromise,
  })
}
