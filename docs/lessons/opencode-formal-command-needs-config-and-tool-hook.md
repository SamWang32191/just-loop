---
id: opencode-formal-command-needs-config-and-tool-hook
date: 2026-03-24
scope: project
tags:
  - opencode
  - commands
  - plugin
  - hooks
  - ralph-loop
source: bug-fix
confidence: 0.5
related:
  - ralph-loop-state-store-path
---

# OpenCode formal commands need both config registration and tool hook side effects

## Context
While aligning `just-loop` with the reference Ralph Loop command behavior, the repo already parsed `/ralph-loop` and `/cancel-ralph` from `chat.message`.

## Mistake
That was enough to handle raw slash-like text in chat, but it did not register real OpenCode commands. Once commands are surfaced through the formal command system, command templates run through the host flow and plugin side effects no longer come from `chat.message`.

## Lesson
For formal OpenCode slash commands in this project:

1. Register the command definitions through the plugin `config` hook under `config.command`.
2. If the command must trigger plugin-controlled state transitions or side effects, also handle it in `tool.execute.before` for the corresponding command tool invocation.

Registering the command alone makes it discoverable and gives it a template prompt, but it does not guarantee loop state changes happen.

## When to Apply
Apply this whenever adding or migrating formal slash commands in `just-loop`, especially commands that must mutate plugin-managed state before or during execution.
