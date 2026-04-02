---
id: opencode-tui-command-execute-uses-top-level-command
date: 2026-04-02
scope: project
tags:
  - opencode
  - plugin
  - tui
  - command
  - interrupt
source: bug-fix
confidence: 0.5
related: []
---

# OpenCode `tui.command.execute` uses top-level `command`

## Context
While debugging why pressing ESC did not cancel the Ralph Loop continuation countdown in `just-loop`, the plugin's TUI command handler was inspected against the OpenCode plugin SDK event shape.

## Mistake
The handler read `properties.command`, but the official `tui.command.execute` payload exposes `command` at the top level.

## Lesson
When handling OpenCode `tui.command.execute`, read the top-level `command` field instead of looking under `properties`, especially for `session.interrupt`.

## When to Apply
Apply this whenever implementing or testing OpenCode TUI command hooks in `just-loop`, especially ESC / interrupt flows and other keyboard-triggered commands.
