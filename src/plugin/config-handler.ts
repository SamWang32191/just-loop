import { resolvePluginConfig } from "./plugin-config.js"
import { getBuiltinCommands } from "./command-definitions.js"

export async function handleConfig(input: Record<string, unknown>) {
  const resolvedConfig = resolvePluginConfig(input)
  const existingCommands =
    input.command && typeof input.command === "object"
      ? (input.command as Record<string, unknown>)
      : {}

  input.command = resolvedConfig.enabled
    ? {
        ...getBuiltinCommands(),
        ...existingCommands,
      }
    : existingCommands

  return resolvedConfig
}
