---
id: orphaned-loop-cleanup-must-revalidate-state
date: 2026-03-24
scope: feature
tags:
  - ralph-loop
  - concurrency
  - state
  - recovery
  - idle-event
source: bug-fix
confidence: 0.5
related: []
---

# Orphaned loop cleanup must revalidate state after async checks

## Context
While adding stale-state cleanup for unrelated `session.idle` events in `just-loop`, the loop core started checking whether the tracked session still existed before clearing persisted Ralph Loop state.

## Mistake
The first implementation cleared state immediately after `sessionExists()` returned `false`, based on the state snapshot read before the async check. If a new loop started while that check was in flight, the cleanup branch could delete the newer loop state.

## Lesson
When async cleanup logic decides whether to delete persisted loop state, re-read the current state after the async check and verify it still matches the originally observed session/incarnation before mutating storage.

## When to Apply
Apply this whenever adding orphan recovery, stale cleanup, or session-existence checks around persisted state in `just-loop`, especially inside event handlers that can race with restart or cancel flows.
