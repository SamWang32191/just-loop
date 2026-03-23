export type BuildContinuationPromptInput = {
  iteration: number
  prompt: string
  completionPromise: string
  maxIterations?: number
}

export function buildContinuationPrompt(input: BuildContinuationPromptInput) {
  return [
    `Continue Ralph Loop iteration ${input.iteration}.`,
    ...(input.maxIterations === undefined ? [] : [`Max iterations: ${input.maxIterations}`]),
    `Original task: ${input.prompt}`,
    `Emit ${input.completionPromise} when complete.`,
  ].join("\n")
}
