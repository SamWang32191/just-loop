import { DEFAULT_MAX_ITERATIONS_FALLBACK, DEFAULT_STRATEGY } from "../ralph-loop/constants.js"
import type { RalphLoopPluginConfigInput, RalphLoopRuntimeConfig } from "../ralph-loop/types.js"

type ConfigInput = Record<string, unknown> & {
  ralph_loop?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseEnabled(value: unknown) {
  if (value === undefined) return true
  if (typeof value === "boolean") return value
  throw new Error("ralph_loop.enabled must be a boolean")
}

function parseDefaultMaxIterations(value: unknown) {
  if (value === undefined) return DEFAULT_MAX_ITERATIONS_FALLBACK
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value
  throw new Error("ralph_loop.default_max_iterations must be a positive integer")
}

function parseDefaultStrategy(value: unknown): RalphLoopRuntimeConfig["defaultStrategy"] {
  if (value === undefined) return DEFAULT_STRATEGY
  if (value === "continue") return value
  throw new Error("ralph_loop.default_strategy must be 'continue'")
}

export function resolvePluginConfig(input: ConfigInput): RalphLoopRuntimeConfig {
  const rawConfig = isObject(input.ralph_loop) ? (input.ralph_loop as RalphLoopPluginConfigInput) : {}

  return {
    enabled: parseEnabled(rawConfig.enabled),
    defaultMaxIterations: parseDefaultMaxIterations(rawConfig.default_max_iterations),
    defaultStrategy: parseDefaultStrategy(rawConfig.default_strategy),
  }
}
