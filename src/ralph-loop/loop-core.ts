import { DEFAULT_COMPLETION_PROMISE, DEFAULT_MAX_ITERATIONS_FALLBACK, DEFAULT_STRATEGY } from "./constants.js"
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

export type CreateLoopCoreDeps = {
  rootDir: string
  adapter: HostAdapter
  getConfig?: () => RalphLoopRuntimeConfig
}

export type StartLoopOptions = {
  maxIterations?: number
  completionPromise?: string
}

export function createLoopCore(deps: CreateLoopCoreDeps) {
  const inFlight = new Map<string, string>()
  const getConfig = () =>
    deps.getConfig?.() ?? {
      enabled: true,
      defaultMaxIterations: DEFAULT_MAX_ITERATIONS_FALLBACK,
      defaultStrategy: DEFAULT_STRATEGY,
    }

  const getToken = (state: { incarnation_token?: string; started_at: string }) =>
    state.incarnation_token ?? state.started_at

  return {
    async startLoop(sessionID: string, prompt: string, options: StartLoopOptions = {}) {
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
    },

    async cancelLoop(sessionID: string) {
      const state = await readState(deps.rootDir)
      if (!state || !state.active || state.session_id !== sessionID) return

      await deps.adapter.abortSession(sessionID)
      await clearState(deps.rootDir)
    },

    async handleEvent(event: LoopEvent) {
      if (event.type === "session.deleted" || event.type === "session.error") {
        const state = await readState(deps.rootDir)
        if (state && state.active && state.session_id === event.sessionID) {
          await clearState(deps.rootDir)
        }

        return
      }

      try {
        const state = await readState(deps.rootDir)
        if (!state || !state.active) return
        if (state.session_id !== event.sessionID) {
          const stillExists = await deps.adapter.sessionExists(state.session_id)
          if (!stillExists) {
            await clearState(deps.rootDir)
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

        const liveState = await readState(deps.rootDir)
        if (
          !liveState ||
          !liveState.active ||
          liveState.session_id !== event.sessionID ||
          getToken(liveState) !== incarnationToken
        ) {
          return
        }
        const currentLiveState = liveState

        if (detectCompletion(messages, currentLiveState.completion_promise, currentLiveState.message_count_at_start)) {
          await clearState(deps.rootDir)
          return
        }

        const nextIteration = currentLiveState.iteration + 1
        if (
          typeof currentLiveState.max_iterations === "number" &&
          nextIteration > currentLiveState.max_iterations
        ) {
          await clearState(deps.rootDir)
          return
        }

        await deps.adapter.prompt(
          event.sessionID,
          buildContinuationPrompt({
            iteration: nextIteration,
            prompt: currentLiveState.prompt,
            completionPromise: currentLiveState.completion_promise,
            maxIterations: currentLiveState.max_iterations,
          }),
        )

        const currentState = await readState(deps.rootDir)
        if (
          !currentState ||
          !currentState.active ||
          currentState.session_id !== event.sessionID ||
          getToken(currentState) !== incarnationToken
        ) {
          return
        }
        const persistedState = currentState

        const nextState: RalphLoopState = {
          ...persistedState,
          iteration: nextIteration,
          last_message_count_processed: batchMessageCount,
        }
        await writeState(deps.rootDir, nextState)

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
