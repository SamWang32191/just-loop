import { afterEach, describe, expect, it } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_COMPLETION_PROMISE, DEFAULT_STATE_PATH } from "../../src/ralph-loop/constants"
import { clearState, readState, writeState } from "../../src/ralph-loop/state-store"
import type { RalphLoopState } from "../../src/ralph-loop/types"

const createdRoots: string[] = []

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), "ralph-loop-state-store-"))
  createdRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("ralph-loop constants", () => {
  it("uses the fixed default state path and completion promise", () => {
    expect(DEFAULT_STATE_PATH).toBe(".loop/ralph-loop.local.md")
    expect(DEFAULT_COMPLETION_PROMISE).toBe("<promise>DONE</promise>")
  })
})

describe("state-store", () => {
  it("writes, reads, and clears state at the fixed path", async () => {
    const root = await createRoot()
    const state: RalphLoopState = {
      active: true,
      session_id: "session-123",
      prompt: "build the plugin",
      iteration: 1,
      max_iterations: 3,
      completion_promise: DEFAULT_COMPLETION_PROMISE,
      message_count_at_start: 7,
      started_at: "2026-03-23T10:00:00.000Z",
    }

    await writeState(root, state)

    const filePath = join(root, DEFAULT_STATE_PATH)
    expect(await readFile(filePath, "utf8")).toContain('"session_id": "session-123"')
    expect(await readState(root)).toEqual(state)

    await clearState(root)
    expect(await readState(root)).toBeNull()
  })

  it("returns null when the state file does not exist", async () => {
    const root = await createRoot()

    expect(await readState(root)).toBeNull()
  })

  it("throws on malformed JSON", async () => {
    const root = await createRoot()
    const filePath = join(root, DEFAULT_STATE_PATH)
    await mkdir(join(root, ".loop"), { recursive: true })
    await writeFile(filePath, "{ not-json", "utf8")

    await expect(readState(root)).rejects.toThrow("invalid RalphLoopState JSON")
  })

  it("throws on invalid state shape", async () => {
    const root = await createRoot()
    const filePath = join(root, DEFAULT_STATE_PATH)
    await mkdir(join(root, ".loop"), { recursive: true })
    await writeFile(
      filePath,
      JSON.stringify({ active: true, session_id: "session-123", prompt: "task" }),
      "utf8",
    )

    await expect(readState(root)).rejects.toThrow("invalid RalphLoopState shape")
  })
})
