import { DEFAULT_COMPLETION_PROMISE } from "../ralph-loop/constants.js"

export type RalphLoopStartCommand = {
  kind: "start"
  prompt: string
  maxIterations?: number
  completionPromise: string
}

export type RalphLoopCancelCommand = {
  kind: "cancel"
}

export type ParsedRalphLoopCommand = RalphLoopStartCommand | RalphLoopCancelCommand

export function parseRalphLoopCommand(input: string): ParsedRalphLoopCommand | null {
  const trimmed = input.trim()

  if (trimmed === "/cancel-ralph") {
    return { kind: "cancel" }
  }

  if (!/^\/ralph-loop(?:\s|$)/.test(trimmed)) {
    return null
  }

  let rest = trimmed.slice("/ralph-loop".length)
  let maxIterations: number | undefined
  let completionPromise = DEFAULT_COMPLETION_PROMISE

  while (true) {
    rest = rest.replace(/^\s+/, "")

    if (!rest.startsWith("--")) {
      break
    }

    if (/^--max-iterations=/.test(rest)) {
      const valueMatch = rest.match(/^--max-iterations=([0-9]+)(?:\s+|$)/)
      if (!valueMatch) {
        throw new Error("invalid --max-iterations value")
      }

      maxIterations = Number(valueMatch[1])
      rest = rest.slice(valueMatch[0].length)
      continue
    }

    if (/^--max(?:\s|$)/.test(rest)) {
      const valueMatch = rest.match(/^--max(?:\s+(\S+))(?:\s+|$)/)
      if (!valueMatch || !/^[0-9]+$/.test(valueMatch[1])) {
        throw new Error("invalid --max value")
      }

      maxIterations = Number(valueMatch[1])
      rest = rest.slice(valueMatch[0].length)
      continue
    }

    if (/^--promise(?:\s|$)/.test(rest)) {
      const promiseMatch = rest.match(/^--promise\s+"([^"]+)"(?:\s+|$)/)
      if (!promiseMatch) {
        throw new Error("invalid --promise format")
      }

      completionPromise = promiseMatch[1]
      rest = rest.slice(promiseMatch[0].length)
      continue
    }

    if (/^--completion-promise=/.test(rest)) {
      const promiseMatch = rest.match(/^--completion-promise=([^\s]+)(?:\s+|$)/)
      if (!promiseMatch) {
        throw new Error("invalid --completion-promise format")
      }

      completionPromise = promiseMatch[1]
      rest = rest.slice(promiseMatch[0].length)
      continue
    }

    if (/^--strategy(?:\s|$)/.test(rest)) {
      const strategyMatch = rest.match(/^--strategy(?:\s+(\S+))(?:\s+|$)/)
      if (!strategyMatch) {
        throw new Error("invalid --strategy value")
      }

      if (strategyMatch[1] === "reset") {
        throw new Error("reset strategy is not supported in v1")
      }

      throw new Error("invalid --strategy value")
    }

    if (/^--strategy=/.test(rest)) {
      const strategyMatch = rest.match(/^--strategy=([^\s]+)(?:\s+|$)/)
      if (!strategyMatch) {
        throw new Error("invalid --strategy value")
      }

      if (strategyMatch[1] === "continue") {
        rest = rest.slice(strategyMatch[0].length)
        continue
      }

      if (strategyMatch[1] === "reset") {
        throw new Error("reset strategy is not supported in v1")
      }

      throw new Error("invalid --strategy value")
    }

    throw new Error("unknown flag")
  }

  const prompt = rest.trim().replace(/\s+/g, " ")

  if (!prompt) {
    throw new Error("prompt is required")
  }

  return {
    kind: "start",
    prompt,
    maxIterations,
    completionPromise,
  }
}
