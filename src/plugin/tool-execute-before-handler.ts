import { parseRalphLoopCommand } from "../commands/parse-ralph-loop-command.js"

type LoopCore = {
  startLoop: (sessionID: string, prompt: string, options: { maxIterations?: number; completionPromise?: string }) => Promise<unknown>
  cancelLoop: (sessionID: string) => Promise<unknown>
}

type ToolExecuteBeforeOptions = {
  defaultMaxIterations?: number
}

type ToolExecuteBeforeInput = {
  tool?: unknown
  sessionID?: unknown
}

type ToolExecuteBeforeOutput = {
  args?: {
    name?: unknown
  }
}

function normalizeCommandName(name: string) {
  return name.startsWith("/") ? name : `/${name}`
}

export async function handleToolExecuteBefore(
  input: ToolExecuteBeforeInput,
  output: ToolExecuteBeforeOutput,
  core: LoopCore,
  options: ToolExecuteBeforeOptions = {},
) {
  if (input.tool !== "skill") return
  if (typeof input.sessionID !== "string") return
  if (typeof output.args?.name !== "string") return

  const command = parseRalphLoopCommand(normalizeCommandName(output.args.name))
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
