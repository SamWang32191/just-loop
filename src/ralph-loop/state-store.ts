import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { DEFAULT_STATE_PATH } from "./constants.js"
import type { RalphLoopState } from "./types.js"

function getStateFilePath(root: string) {
  return join(root, DEFAULT_STATE_PATH)
}

function isRalphLoopState(value: unknown): value is RalphLoopState {
  if (typeof value !== "object" || value === null) return false

  const record = value as Record<string, unknown>
  return (
    typeof record.active === "boolean" &&
    typeof record.session_id === "string" &&
    typeof record.prompt === "string" &&
    typeof record.iteration === "number" &&
    (record.max_iterations === undefined || typeof record.max_iterations === "number") &&
    typeof record.completion_promise === "string" &&
    typeof record.message_count_at_start === "number" &&
    (record.last_message_count_processed === undefined || typeof record.last_message_count_processed === "number") &&
    (record.skip_next_continuation === undefined || typeof record.skip_next_continuation === "boolean") &&
    (record.pending_continuation === undefined ||
      (typeof record.pending_continuation === "object" &&
        record.pending_continuation !== null &&
        typeof (record.pending_continuation as Record<string, unknown>).started_at === "string" &&
        typeof (record.pending_continuation as Record<string, unknown>).countdown_seconds_remaining === "number" &&
        ((record.pending_continuation as Record<string, unknown>).cancelled === undefined ||
          typeof (record.pending_continuation as Record<string, unknown>).cancelled === "boolean") &&
        ((record.pending_continuation as Record<string, unknown>).dispatch_token === undefined ||
          typeof (record.pending_continuation as Record<string, unknown>).dispatch_token === "string"))) &&
    (record.incarnation_token === undefined || typeof record.incarnation_token === "string") &&
    typeof record.started_at === "string"
  )
}

export async function writeState(root: string, state: RalphLoopState): Promise<void> {
  const filePath = getStateFilePath(root)
  const tempFilePath = `${filePath}.${randomUUID()}.tmp`
  await mkdir(dirname(filePath), { recursive: true })

  try {
    await writeFile(tempFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
    await rename(tempFilePath, filePath)
  } catch (error) {
    await rm(tempFilePath, { force: true })
    throw error
  }
}

export async function readState(root: string): Promise<RalphLoopState | null> {
  const filePath = getStateFilePath(root)

  try {
    const content = await readFile(filePath, "utf8")
    const parsed = JSON.parse(content) as unknown

    if (!isRalphLoopState(parsed)) {
      throw new Error("invalid RalphLoopState shape")
    }

    return parsed
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("invalid RalphLoopState JSON", { cause: error })
    }

    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

export async function clearState(root: string): Promise<void> {
  await rm(getStateFilePath(root), { force: true })
}
