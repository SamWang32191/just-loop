---
id: ralph-loop-state-store-path
date: 2026-03-23
scope: project
tags:
  - ralph-loop
  - storage
  - path
  - state-file
source: user-correction
confidence: 0.7
related: []
---

# Ralph Loop state store must use `.loop/ralph-loop.local.md`

## Context
During design of `my-loop-plugin`, the reference plugin used `.sisyphus/ralph-loop.local.md` for persisted Ralph Loop state.

## Mistake
I initially carried over the reference plugin's state file path when describing the design.

## Lesson
For this project, Ralph Loop persisted state must use the project-specific path `.loop/ralph-loop.local.md` rather than inheriting the reference plugin's `.sisyphus` path.

## When to Apply
Apply this rule whenever describing, implementing, testing, or documenting Ralph Loop storage behavior in `my-loop-plugin`.
