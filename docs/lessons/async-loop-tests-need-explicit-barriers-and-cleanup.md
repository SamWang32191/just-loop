---
id: async-loop-tests-need-explicit-barriers-and-cleanup
date: 2026-04-02
scope: feature
tags:
  - test
  - async
  - race
  - ralph-loop
  - cleanup
source: bug-fix
confidence: 0.5
related: []
---

# Async Ralph Loop tests need explicit barriers and guaranteed cleanup

## Context
Countdown tests around Ralph Loop idle continuation failed in CI even though the logic path was intended to work.

## Mistake
The tests assumed one `setTimeout(0)` was enough for async state I/O and countdown setup to finish, and when an assertion failed early they left background async work running into the next test.

## Lesson
For async loop/countdown tests, synchronize on an explicit barrier such as the first `wait()` entry, a persisted state predicate, or a known prompt/toast callback. Also use `try/finally` to resolve deferred waits and `await Promise.allSettled(...)` so failed assertions do not leak in-flight work into later tests.

## When to Apply
Apply this when testing long-running loop logic, countdowns, deferred prompts, or any flow that continues doing background async work after the first assertion point.
