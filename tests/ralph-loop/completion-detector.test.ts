import { describe, expect, it } from "bun:test"
import { DEFAULT_COMPLETION_PROMISE } from "../../src/ralph-loop/constants"
import { buildContinuationPrompt } from "../../src/ralph-loop/continuation-prompt"
import { detectCompletion } from "../../src/ralph-loop/completion-detector"

describe("detectCompletion", () => {
  it("accepts readonly message arrays", () => {
    const messages: ReadonlyArray<{ role: string; text: string }> = [
      { role: "assistant", text: "still working" },
      { role: "assistant", text: DEFAULT_COMPLETION_PROMISE },
    ]

    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 0)).toBe(true)
  })

  it("only scans messages after the boundary and ignores user text", () => {
    const messages = [
      { role: "assistant", text: DEFAULT_COMPLETION_PROMISE },
      { role: "user", text: DEFAULT_COMPLETION_PROMISE },
      { role: "assistant", text: "still working" },
      { role: "user", text: `done ${DEFAULT_COMPLETION_PROMISE}` },
    ] as const

    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 2)).toBe(false)
    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 3)).toBe(false)
  })

  it("finds completion in assistant text after the boundary", () => {
    const messages = [
      { role: "assistant", text: "still working" },
      { role: "user", text: DEFAULT_COMPLETION_PROMISE },
      { role: "assistant", text: DEFAULT_COMPLETION_PROMISE },
    ] as const

    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 1)).toBe(true)
  })

  it("does not count a user-only exact completion promise after the boundary", () => {
    const messages = [
      { role: "assistant", text: "still working" },
      { role: "user", text: DEFAULT_COMPLETION_PROMISE },
    ] as const

    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 1)).toBe(false)
  })

  it("does not match assistant mentions that are not a completed promise", () => {
    const messages = [
      { role: "assistant", text: `I will emit ${DEFAULT_COMPLETION_PROMISE} later` },
    ] as const

    expect(detectCompletion(messages, DEFAULT_COMPLETION_PROMISE, 0)).toBe(false)
  })
})

describe("buildContinuationPrompt", () => {
  it("renders a stable continuation prompt contract", () => {
    const prompt = buildContinuationPrompt({
      iteration: 2,
      prompt: "build plugin",
      completionPromise: DEFAULT_COMPLETION_PROMISE,
      maxIterations: 5,
    })

    expect(prompt.split("\n")).toEqual([
      "Continue Ralph Loop iteration 2.",
      "Max iterations: 5",
      "Original task: build plugin",
      `Emit ${DEFAULT_COMPLETION_PROMISE} when complete.`,
    ])
  })

  it("uses a custom completion promise instead of hardcoding the default", () => {
    const customPromise = "<promise>SHIP</promise>"

    const prompt = buildContinuationPrompt({
      iteration: 1,
      prompt: "ship it",
      completionPromise: customPromise,
    })

    expect(prompt).toContain(`Emit ${customPromise} when complete.`)
    expect(prompt).not.toContain(DEFAULT_COMPLETION_PROMISE)
  })
})
