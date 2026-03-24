import { describe, expect, it } from "bun:test"
import { parseRalphLoopCommand } from "../../src/commands/parse-ralph-loop-command"
import { DEFAULT_COMPLETION_PROMISE } from "../../src/ralph-loop/constants"

describe("parseRalphLoopCommand", () => {
  it("returns null for non-command text", () => {
    expect(parseRalphLoopCommand("hello world")).toBeNull()
  })

  it("returns null for lookalike commands", () => {
    expect(parseRalphLoopCommand("/ralph-loopx test")).toBeNull()
  })

  it("parses cancel command", () => {
    expect(parseRalphLoopCommand("/cancel-ralph")).toEqual({ kind: "cancel" })
  })

  it("parses prompt and max iterations", () => {
    expect(parseRalphLoopCommand("/ralph-loop --max 3 build plugin")).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: 3,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("parses canonical equals-style flags and continue strategy", () => {
    expect(
      parseRalphLoopCommand("/ralph-loop --max-iterations=7 --completion-promise=SHIP --strategy=continue task"),
    ).toEqual({
      kind: "start",
      prompt: "task",
      maxIterations: 7,
      completionPromise: "SHIP",
    })
  })

  it("parses custom completion promise", () => {
    expect(
      parseRalphLoopCommand('/ralph-loop --promise "<promise>SHIP</promise>" build plugin'),
    ).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: undefined,
      completionPromise: "<promise>SHIP</promise>",
    })
  })

  it("keeps flag-like text inside the prompt", () => {
    expect(parseRalphLoopCommand("/ralph-loop build --max 3 plugin")).toEqual({
      kind: "start",
      prompt: "build --max 3 plugin",
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("rejects invalid max values", () => {
    expect(() => parseRalphLoopCommand("/ralph-loop --max -1 task")).toThrow()
    expect(() => parseRalphLoopCommand("/ralph-loop --max foo task")).toThrow()
    expect(() => parseRalphLoopCommand("/ralph-loop --max 3foo task")).toThrow()
  })

  it("rejects unterminated promise flags", () => {
    expect(() => parseRalphLoopCommand('/ralph-loop --promise "SHIP task')).toThrow()
  })

  it("rejects promise values that do not end cleanly", () => {
    expect(() => parseRalphLoopCommand('/ralph-loop --promise "X"build')).toThrow()
  })

  it("treats lookalike flags as unknown", () => {
    expect(() => parseRalphLoopCommand("/ralph-loop --maxx 3 task")).toThrow("unknown flag")
    expect(() => parseRalphLoopCommand('/ralph-loop --promiseful "X" task')).toThrow(
      "unknown flag",
    )
    expect(() => parseRalphLoopCommand("/ralph-loop --strategyy reset task")).toThrow(
      "unknown flag",
    )
  })

  it("rejects empty prompt", () => {
    expect(() => parseRalphLoopCommand("/ralph-loop")).toThrow()
    expect(() => parseRalphLoopCommand("/ralph-loop --max 3")).toThrow()
  })

  it("rejects reset strategy in v1", () => {
    expect(() => parseRalphLoopCommand("/ralph-loop --strategy reset task")).toThrow(
      "reset strategy is not supported in v1",
    )
  })
})
