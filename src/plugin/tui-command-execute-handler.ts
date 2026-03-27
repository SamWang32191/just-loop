type LoopCore = {
  handleEvent: (event: { type: "session.interrupt" }) => Promise<unknown>
}

export type TuiCommandExecuteInput = unknown

function hasInterruptCommand(input: TuiCommandExecuteInput) {
  if (!input || typeof input !== "object") return false

  const properties = (input as { properties?: unknown }).properties
  if (!properties || typeof properties !== "object") return false

  return (properties as { command?: unknown }).command === "session.interrupt"
}

export async function handleTuiCommandExecute(input: TuiCommandExecuteInput, core: LoopCore) {
  if (!hasInterruptCommand(input)) return

  // active-loop-scoped only: even though the core event name is session.interrupt,
  // tui.command.execute does not provide sessionID, so this forwards a loop-level interrupt.
  await core.handleEvent({ type: "session.interrupt" })
}
