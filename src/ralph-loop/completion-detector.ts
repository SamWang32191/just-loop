export type RalphLoopMessage = {
  role: string
  text: string
}

export function detectCompletion(
  messages: ReadonlyArray<RalphLoopMessage>,
  promise: string,
  boundary: number,
) {
  return messages.slice(boundary).some(
    (message) =>
      message.role === "assistant" &&
      message.text.split(/\r?\n/).some((line) => line.trim() === promise),
  )
}
