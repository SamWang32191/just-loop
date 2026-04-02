import { describe, expect, it } from "bun:test"
import { parseRalphLoopCommand } from "../../src/commands/parse-ralph-loop-command"
import { DEFAULT_COMPLETION_PROMISE } from "../../src/ralph-loop/constants"

describe("parseRalphLoopCommand", () => {
  it("returns null for non-command text", () => {
    expect(parseRalphLoopCommand("hello world")).toBeNull()
  })

  it("returns null for lookalike commands", () => {
    expect(parseRalphLoopCommand("/just-loopx test")).toBeNull()
  })

  it("returns null for old command", () => {
    expect(parseRalphLoopCommand("/ralph-loop test")).toBeNull()
  })

  it("parses cancel command", () => {
    expect(parseRalphLoopCommand("/cancel-ralph")).toEqual({ kind: "cancel" })
  })

  it("parses prompt and max iterations", () => {
    expect(parseRalphLoopCommand("/just-loop --max 3 build plugin")).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: 3,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("parses canonical equals-style flags and continue strategy", () => {
    expect(
      parseRalphLoopCommand("/just-loop --max-iterations=7 --completion-promise=SHIP --strategy=continue task"),
    ).toEqual({
      kind: "start",
      prompt: "task",
      maxIterations: 7,
      completionPromise: "SHIP",
    })
  })

  it("parses custom completion promise", () => {
    expect(
      parseRalphLoopCommand('/just-loop --promise "<promise>SHIP</promise>" build plugin'),
    ).toEqual({
      kind: "start",
      prompt: "build plugin",
      maxIterations: undefined,
      completionPromise: "<promise>SHIP</promise>",
    })
  })

  it("keeps flag-like text inside the prompt", () => {
    expect(parseRalphLoopCommand("/just-loop build --max 3 plugin")).toEqual({
      kind: "start",
      prompt: "build --max 3 plugin",
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("treats trailing canonical flags as prompt text", () => {
    expect(parseRalphLoopCommand("/just-loop build --max-iterations=7")).toEqual({
      kind: "start",
      prompt: "build --max-iterations=7",
      maxIterations: undefined,
      completionPromise: DEFAULT_COMPLETION_PROMISE,
    })
  })

  it("rejects invalid max values", () => {
    expect(() => parseRalphLoopCommand("/just-loop --max -1 task")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max foo task")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max 3foo task")).toThrow()
  })

  it("rejects unterminated promise flags", () => {
    expect(() => parseRalphLoopCommand('/just-loop --promise "SHIP task')).toThrow()
  })

  it("rejects promise values that do not end cleanly", () => {
    expect(() => parseRalphLoopCommand('/just-loop --promise "X"build')).toThrow()
  })

  it("treats lookalike flags as unknown", () => {
    expect(() => parseRalphLoopCommand("/just-loop --maxx 3 task")).toThrow("unknown flag")
    expect(() => parseRalphLoopCommand('/just-loop --promiseful "X" task')).toThrow(
      "unknown flag",
    )
    expect(() => parseRalphLoopCommand("/just-loop --strategyy reset task")).toThrow(
      "unknown flag",
    )
  })

  it("rejects empty prompt", () => {
    expect(() => parseRalphLoopCommand("/just-loop")).toThrow()
    expect(() => parseRalphLoopCommand("/just-loop --max 3")).toThrow()
  })

  it("rejects reset strategy in v1", () => {
    expect(() => parseRalphLoopCommand("/just-loop --strategy reset task")).toThrow(
      "reset strategy is not supported in v1",
    )
  })
})
