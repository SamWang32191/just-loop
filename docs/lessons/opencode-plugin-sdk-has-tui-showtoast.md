---
id: opencode-plugin-sdk-has-tui-showtoast
date: 2026-04-02
scope: project
tags:
  - opencode
  - plugin
  - tui
  - toast
  - sdk
source: user-correction
confidence: 0.7
related:
  - opencode-formal-command-needs-config-and-tool-hook
---

# OpenCode plugin SDK already exposes `client.tui.showToast`

## Context
While designing Ralph Loop countdown UX in `just-loop`, I initially assumed the plugin host only exposed session APIs and had no built-in toast/status UI.

## Mistake
That assumption led me to design around a UI limitation that did not actually exist, until the user pointed out that `@opencode-ai/plugin` already supports `showToast`.

## Lesson
Before declaring that OpenCode plugin UI feedback is unavailable, verify whether `client.tui.showToast` exists in the current SDK/runtime. In this project, toast notifications should go through the host adapter boundary rather than inventing a separate notification mechanism.

## When to Apply
Apply this when designing or implementing user-visible plugin feedback in `just-loop`, especially countdowns, warnings, loop status notifications, or any feature that may need TUI toasts.
