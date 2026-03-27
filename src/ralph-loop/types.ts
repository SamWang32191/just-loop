export type RalphLoopState = {
  active: boolean
  session_id: string
  prompt: string
  iteration: number
  max_iterations?: number
  completion_promise: string
  message_count_at_start: number
  last_message_count_processed?: number
  skip_next_continuation?: boolean
  incarnation_token?: string
  started_at: string
}

export type RalphLoopDefaultStrategy = "continue"

export type RalphLoopRuntimeConfig = {
  enabled: boolean
  defaultMaxIterations: number
  defaultStrategy: RalphLoopDefaultStrategy
}

export type RalphLoopPluginConfigInput = {
  enabled?: unknown
  default_max_iterations?: unknown
  default_strategy?: unknown
}
