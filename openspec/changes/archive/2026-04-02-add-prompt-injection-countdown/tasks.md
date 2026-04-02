## 1. State and countdown model

- [x] 1.1 Extend `RalphLoopState` and state-store validation to represent a pending continuation countdown safely.
- [x] 1.2 Add any countdown-specific constants/helpers needed to express the fixed 5-second injection delay.
- [x] 1.3 Extend the plugin/host adapter boundary so Ralph Loop can trigger `showToast` notifications without coupling core logic directly to SDK details.

## 2. Core loop behavior

- [x] 2.1 Update `loop-core.handleEvent()` so continuation decisions enter a pending 5-second countdown before calling `prompt()`.
- [x] 2.2 Ensure duplicate idle events, completion, max-iteration stop, cancel, delete, error, and restart paths clear or ignore stale pending countdowns instead of injecting twice.
- [x] 2.3 Reuse `session.interrupt` / `skip_next_continuation` so a countdown can be cancelled once without deactivating the loop.
- [x] 2.4 Show 5→4→3→2→1 countdown toasts plus cancellation/result toasts with `ctx.client.tui.showToast()` through the new adapter boundary.

## 3. Verification

- [x] 3.1 Add loop-core tests for successful delayed injection, 5→4→3→2→1 toast updates, and duplicate-idle suppression during an active countdown.
- [x] 3.2 Add loop-core tests for countdown cancellation, cancellation toast behavior, one-shot consumption, and cancel/restart or cleanup races while the countdown is pending.
