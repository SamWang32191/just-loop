type LoopEvent =
  | { type: "session.idle"; sessionID: string }
  | { type: "session.deleted"; sessionID: string }
  | { type: "session.error"; sessionID: string }

type EventInput = {
  type?: string
  properties?: {
    sessionID?: unknown
    info?: {
      id?: unknown
    }
  }
}

type LoopCore = {
  handleEvent: (event: LoopEvent) => Promise<unknown>
}

function getSessionID(input: EventInput) {
  if (input.type === "session.deleted") {
    return typeof input.properties?.info?.id === "string" ? input.properties.info.id : null
  }

  if (input.type === "session.idle" || input.type === "session.error") {
    return typeof input.properties?.sessionID === "string" ? input.properties.sessionID : null
  }

  return null
}

export async function handleEvent(input: unknown, core: LoopCore) {
  if (!input || typeof input !== "object") return

  const record = input as EventInput

  if (record.type !== "session.idle" && record.type !== "session.deleted" && record.type !== "session.error") {
    return
  }

  const sessionID = getSessionID(record)
  if (!sessionID) return

  await core.handleEvent({ type: record.type, sessionID } as LoopEvent)
}
