export type RalphLoopState = {
  active: boolean
  session_id: string
  prompt: string
  iteration: number
  max_iterations?: number
  completion_promise: string
  message_count_at_start: number
  last_message_count_processed?: number
  incarnation_token?: string
  started_at: string
}
