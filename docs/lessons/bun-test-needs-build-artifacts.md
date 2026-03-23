---
id: bun-test-needs-build-artifacts
date: 2026-03-23
scope: project
tags:
  - bun
  - test
  - build
  - dist
source: bug-fix
confidence: 0.5
related: []
---

# Use `bun run test` when tests require built dist artifacts

## Context
A baseline test failure reported that `dist/src/index.d.ts` was missing in a clean worktree.

## Mistake
I first ran `bun test` directly, which skipped the package test script that builds the project before running the test suite.

## Lesson
If the test suite checks files under `dist/`, use the package test script (`bun run test`) or run build first. Running `bun test` directly can produce a false failing baseline when required build artifacts do not exist yet.

## When to Apply
Apply this rule whenever Bun tests assert built output or import files from `dist/`.
