export type HostMessage = {
  role: string
  text: string
}

export interface HostAdapter {
  getMessageCount(sessionID: string): Promise<number>
  getMessages(sessionID: string): Promise<Array<HostMessage>>
  prompt(sessionID: string, text: string): Promise<void>
  abortSession(sessionID: string): Promise<void>
  sessionExists(sessionID: string): Promise<boolean>
  showToast?(toast: {
    title: string
    message: string
    variant?: "info" | "warning" | "error" | "success"
    duration?: number
  }): Promise<void>
}

export type OpenCodeHostAdapterContext = {
  directory: string
  client: {
    session: {
      messages: (input: { sessionID: string; directory: string }) => Promise<unknown>
      promptAsync?: (input: {
        sessionID: string
        directory: string
        parts: Array<{ type: "text"; text: string }>
      }) => Promise<unknown>
      prompt: (input: { sessionID: string; directory: string; parts: Array<{ type: "text"; text: string }> }) => Promise<unknown>
      abort: (input: { sessionID: string; directory?: string }) => Promise<unknown>
    }
    tui?: {
      showToast?: (input: {
        body: { title: string; message: string; variant?: "info" | "warning" | "error" | "success"; duration?: number }
      }) => Promise<unknown>
    }
  }
}
