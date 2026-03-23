---
id: git-worktree-root-rename-order
date: 2026-03-23
scope: project
tags:
  - git
  - worktree
  - rename
  - path
source: bug-fix
confidence: 0.5
related: []
---

# Remove linked worktrees before renaming repo root

## Context
A project rename required changing the repository root directory name while a linked git worktree still existed under `.worktrees/`.

## Mistake
I initially planned to rename the repository root directly after making changes inside the linked worktree.

## Lesson
Git worktree metadata stores absolute paths. If the repository root directory itself must be renamed, first move any needed changes back to the main working tree, then remove the linked worktree, and only then rename the repository root.

## When to Apply
Apply this rule whenever a task needs to rename the repository root directory while linked git worktrees still exist.
