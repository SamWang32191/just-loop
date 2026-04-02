import {
  CONTINUATION_COUNTDOWN_SECONDS,
  CONTINUATION_COUNTDOWN_STEP_MS,
  DEFAULT_COMPLETION_PROMISE,
  DEFAULT_MAX_ITERATIONS_FALLBACK,
  DEFAULT_STRATEGY,
} from "./constants.js"
import { buildContinuationPrompt } from "./continuation-prompt.js"
import { detectCompletion } from "./completion-detector.js"
import { clearState, readState, writeState } from "./state-store.js"
import type { HostAdapter } from "../host-adapter/types.js"
import { randomUUID } from "node:crypto"
import type { RalphLoopRuntimeConfig, RalphLoopState } from "./types.js"

export type LoopEvent =
  | { type: "session.idle"; sessionID: string }
  | { type: "session.deleted"; sessionID: string }
  | { type: "session.error"; sessionID: string }
  | { type: "session.interrupt" }

export type CreateLoopCoreDeps = {
  rootDir: string
  adapter: HostAdapter
  getConfig?: () => RalphLoopRuntimeConfig
  wait?: (ms: number) => Promise<void>
}

export type StartLoopOptions = {
  maxIterations?: number
  completionPromise?: string
}

export function createLoopCore(deps: CreateLoopCoreDeps) {
  const inFlight = new Map<string, string>()
  let stateMutationQueue: Promise<void> = Promise.resolve()
  const getConfig = () =>
    deps.getConfig?.() ?? {
      enabled: true,
      defaultMaxIterations: DEFAULT_MAX_ITERATIONS_FALLBACK,
      defaultStrategy: DEFAULT_STRATEGY,
    }

  const getToken = (state: { incarnation_token?: string; started_at: string }) =>
    state.incarnation_token ?? state.started_at

  const wait = deps.wait

  function showToast(title: string, message: string, variant: "info" | "warning" | "success" = "info") {
    void deps.adapter.showToast?.({ title, message, variant, duration: 1000 }).catch(() => {})
  }

  async function readCurrentState(sessionID: string, token: string) {
    const state = await readState(deps.rootDir)
    if (!state || !state.active || state.session_id !== sessionID || getToken(state) !== token) return null
    return state
  }

  const runStateMutation = async <T>(mutation: () => Promise<T>): Promise<T> => {
    const run = stateMutationQueue.then(mutation, mutation)
    stateMutationQueue = run.then(() => undefined, () => undefined)
    return run
  }

  return {
    async startLoop(sessionID: string, prompt: string, options: StartLoopOptions = {}) {
      return await runStateMutation(async () => {
        const config = getConfig()
        const existing = await readState(deps.rootDir)

        if (existing?.active) {
          const stillExists = await deps.adapter.sessionExists(existing.session_id)
          if (stillExists) {
            throw new Error("an active Ralph Loop already exists; use /cancel-ralph first")
          }

          await clearState(deps.rootDir)
        } else if (existing) {
          await clearState(deps.rootDir)
        }

        const messageCountAtStart = await deps.adapter.getMessageCount(sessionID)
        const incarnationToken = randomUUID()
        const state: RalphLoopState = {
          active: true,
          session_id: sessionID,
          prompt,
          iteration: 0,
          max_iterations: options.maxIterations ?? config.defaultMaxIterations,
          completion_promise: options.completionPromise ?? DEFAULT_COMPLETION_PROMISE,
          message_count_at_start: messageCountAtStart,
          incarnation_token: incarnationToken,
          started_at: new Date().toISOString(),
        }

        await writeState(deps.rootDir, state)
      })
    },

    async cancelLoop(sessionID: string) {
      return await runStateMutation(async () => {
        const state = await readState(deps.rootDir)
        if (!state || !state.active || state.session_id !== sessionID) return

        await deps.adapter.abortSession(sessionID)
        await clearState(deps.rootDir)
      })
    },

    async handleEvent(event: LoopEvent) {
      if (event.type === "session.interrupt") {
        return await runStateMutation(async () => {
          const state = await readState(deps.rootDir)
          if (!state || !state.active) return
          if (state.pending_continuation?.cancelled) return

          const observedSessionID = state.session_id
          const observedToken = getToken(state)
          // active-loop-scoped only: the host interrupt hook does not provide sessionID,
          // so we re-read before write and only stamp the currently active incarnation.
          const currentState = await readState(deps.rootDir)
          if (
            !currentState ||
            !currentState.active ||
            currentState.session_id !== observedSessionID ||
            getToken(currentState) !== observedToken
          ) {
            return
          }

          if (currentState.pending_continuation) {
            if (currentState.pending_continuation.dispatch_token) {
              await writeState(deps.rootDir, {
                ...currentState,
                skip_next_continuation: true,
              })
              return
            }
            if (currentState.pending_continuation.cancelled) return
            await writeState(deps.rootDir, {
              ...currentState,
              pending_continuation: { ...currentState.pending_continuation, cancelled: true },
            })
            showToast("Ralph Loop", "Cancelled the pending Ralph Loop continuation.", "info")
            return
          }

          await writeState(deps.rootDir, {
            ...currentState,
            skip_next_continuation: true,
          })
        })
      }

      if (event.type === "session.deleted" || event.type === "session.error") {
        return await runStateMutation(async () => {
          const state = await readState(deps.rootDir)
          if (state && state.active && state.session_id === event.sessionID) {
            await clearState(deps.rootDir)
          }
        })
      }

      try {
        const state = await readState(deps.rootDir)
        if (!state || !state.active) return
        if (state.session_id !== event.sessionID) {
          const observedSessionID = state.session_id
          const observedToken = getToken(state)
          const stillExists = await deps.adapter.sessionExists(observedSessionID)
          if (!stillExists) {
            await runStateMutation(async () => {
              const currentState = await readState(deps.rootDir)
              if (
                currentState &&
                currentState.active &&
                currentState.session_id === observedSessionID &&
                getToken(currentState) === observedToken
              ) {
                await clearState(deps.rootDir)
              }
            })
          }

          return
        }
        const incarnationToken = getToken(state)
        const inFlightToken = inFlight.get(event.sessionID)
        if (inFlightToken === incarnationToken) return
        inFlight.set(event.sessionID, incarnationToken)

        const messages = await deps.adapter.getMessages(event.sessionID)
        const batchMessageCount = messages.length
        const baselineMessageCount = state.last_message_count_processed ?? state.message_count_at_start
        if (batchMessageCount <= baselineMessageCount) return

        const hasNewAssistantMessages = messages
          .slice(baselineMessageCount)
          .some((message) => message.role === "assistant")
        if (!hasNewAssistantMessages) return

        const liveState = await readCurrentState(event.sessionID, incarnationToken)
        if (!liveState) return
        const continuationState = await readCurrentState(event.sessionID, incarnationToken)
        if (!continuationState) return

        if (
          detectCompletion(messages, continuationState.completion_promise, continuationState.message_count_at_start)
        ) {
          await runStateMutation(async () => {
            const currentState = await readState(deps.rootDir)
            if (
              currentState &&
              currentState.active &&
              currentState.session_id === event.sessionID &&
              getToken(currentState) === incarnationToken &&
              detectCompletion(messages, currentState.completion_promise, currentState.message_count_at_start)
            ) {
              await clearState(deps.rootDir)
            }
          })
          return
        }

        const nextIteration = continuationState.iteration + 1
        if (
          typeof continuationState.max_iterations === "number" &&
          nextIteration > continuationState.max_iterations
        ) {
          await runStateMutation(async () => {
            const currentState = await readState(deps.rootDir)
            if (
              currentState &&
              currentState.active &&
              currentState.session_id === event.sessionID &&
              getToken(currentState) === incarnationToken &&
              typeof currentState.max_iterations === "number" &&
              currentState.iteration + 1 > currentState.max_iterations
            ) {
              await clearState(deps.rootDir)
            }
          })
          return
        }

        if (continuationState.skip_next_continuation) {
          // Consume the one-shot suppress flag for the currently active loop only.
          await runStateMutation(async () => {
            const currentState = await readState(deps.rootDir)
            if (
              !currentState ||
              !currentState.active ||
              currentState.session_id !== event.sessionID ||
              getToken(currentState) !== incarnationToken ||
              !currentState.skip_next_continuation
            ) {
              return
            }

            const nextState: RalphLoopState = {
              ...currentState,
              last_message_count_processed: batchMessageCount,
            }
            delete nextState.skip_next_continuation
            await writeState(deps.rootDir, nextState)
          })
          return
        }

        if (wait) {
          await runStateMutation(async () => {
            const currentState = await readCurrentState(event.sessionID, incarnationToken)
            if (!currentState || currentState.pending_continuation) return
            await writeState(deps.rootDir, {
              ...currentState,
              pending_continuation: {
                started_at: new Date().toISOString(),
                countdown_seconds_remaining: CONTINUATION_COUNTDOWN_SECONDS,
              },
            })
          })

          showToast(
            "Ralph Loop",
            `Injecting next continuation in ${CONTINUATION_COUNTDOWN_SECONDS}s. Use interrupt to cancel once.`,
            "warning",
          )

          for (let remaining = CONTINUATION_COUNTDOWN_SECONDS; remaining > 0; remaining -= 1) {
            await wait(CONTINUATION_COUNTDOWN_STEP_MS)
            const currentState = await readCurrentState(event.sessionID, incarnationToken)
            if (!currentState?.pending_continuation) return
            if (currentState.pending_continuation.cancelled) {
              await runStateMutation(async () => {
                const latest = await readCurrentState(event.sessionID, incarnationToken)
                if (!latest?.pending_continuation?.cancelled) return
                const nextState: RalphLoopState = {
                  ...latest,
                  last_message_count_processed: batchMessageCount,
                }
                delete nextState.pending_continuation
                await writeState(deps.rootDir, nextState)
              })
              return
            }

            await runStateMutation(async () => {
              const latest = await readCurrentState(event.sessionID, incarnationToken)
              if (!latest?.pending_continuation || latest.pending_continuation.cancelled) return
              await writeState(deps.rootDir, {
                ...latest,
                pending_continuation: {
                  ...latest.pending_continuation,
                  countdown_seconds_remaining: remaining - 1,
                },
              })
            })

            if (remaining > 1) {
              showToast(
                "Ralph Loop",
                `Injecting next continuation in ${remaining - 1}s. Use interrupt to cancel once.`,
                "warning",
              )
            }
          }

          const dispatchToken = randomUUID()
          const continuationPrompt = buildContinuationPrompt({
            iteration: nextIteration,
            prompt: continuationState.prompt,
            completionPromise: continuationState.completion_promise,
            maxIterations: continuationState.max_iterations,
          })

          const dispatchResult = await runStateMutation(async () => {
            const currentState = await readCurrentState(event.sessionID, incarnationToken)
            if (!currentState?.pending_continuation) return { kind: "aborted" as const }

            if (currentState.pending_continuation.cancelled) {
              const nextState: RalphLoopState = {
                ...currentState,
                last_message_count_processed: batchMessageCount,
              }
              delete nextState.pending_continuation
              await writeState(deps.rootDir, nextState)
              return { kind: "cancelled" as const }
            }

            await writeState(deps.rootDir, {
              ...currentState,
              pending_continuation: {
                ...currentState.pending_continuation,
                countdown_seconds_remaining: 0,
                dispatch_token: dispatchToken,
              },
            })
          })

          if (dispatchResult?.kind === "aborted" || dispatchResult?.kind === "cancelled") {
            return
          }

          try {
            await deps.adapter.prompt(event.sessionID, continuationPrompt)
          } catch (error) {
            await runStateMutation(async () => {
              const latest = await readCurrentState(event.sessionID, incarnationToken)
              if (latest?.pending_continuation?.dispatch_token !== dispatchToken) return
              const nextState: RalphLoopState = { ...latest }
              delete nextState.pending_continuation
              await writeState(deps.rootDir, nextState)
            })
            throw error
          }

          await runStateMutation(async () => {
            const latest = await readCurrentState(event.sessionID, incarnationToken)
            if (!latest?.pending_continuation) return
            if (latest.pending_continuation.dispatch_token !== dispatchToken) return

            const nextState: RalphLoopState = {
              ...latest,
              iteration: nextIteration,
              last_message_count_processed: batchMessageCount,
            }
            delete nextState.pending_continuation
            await writeState(deps.rootDir, nextState)
          })
        }

        if (wait) {
          showToast("Ralph Loop", "Injected Ralph Loop continuation.", "success")
          return
        }

        try {
          await deps.adapter.prompt(
            event.sessionID,
            buildContinuationPrompt({
              iteration: nextIteration,
              prompt: continuationState.prompt,
              completionPromise: continuationState.completion_promise,
              maxIterations: continuationState.max_iterations,
            }),
          )
        } catch (error) {
          await runStateMutation(async () => {
            const currentState = await readCurrentState(event.sessionID, incarnationToken)
            if (!currentState?.pending_continuation) return
            const nextState: RalphLoopState = { ...currentState }
            delete nextState.pending_continuation
            await writeState(deps.rootDir, nextState)
          })
          throw error
        }

        await runStateMutation(async () => {
          const currentState = await readState(deps.rootDir)
          if (
            !currentState ||
            !currentState.active ||
            currentState.session_id !== event.sessionID ||
            getToken(currentState) !== incarnationToken
          ) {
            return
          }

          const nextState: RalphLoopState = {
            ...currentState,
            iteration: nextIteration,
            last_message_count_processed: batchMessageCount,
          }
          await writeState(deps.rootDir, nextState)
        })

        showToast("Ralph Loop", "Injected Ralph Loop continuation.", "success")

      } finally {
        const currentToken = inFlight.get(event.sessionID)
        if (currentToken !== undefined) {
          const state = await readState(deps.rootDir)
          const stateToken = state?.session_id === event.sessionID && state?.active ? getToken(state) : undefined
          if (currentToken === stateToken) {
            inFlight.delete(event.sessionID)
          }
        }
      }
    },
  }
}
