---
id: npm-publish-needs-real-tarball-smoke
date: 2026-03-24
scope: project
tags:
  - npm
  - publish
  - tarball
  - typescript
  - smoke-test
source: retrospective
confidence: 0.3
related: []
---

# Verify npm publish readiness with a real tarball consumer smoke test

## Context
Preparing `just-loop` for npm publish required more than checking `package.json` metadata and local builds.

## Mistake
It is easy to assume that correct `exports`, `types`, and `files` fields are enough, even though the actual packed tarball may differ and TypeScript consumers may still fail to resolve published types.

## Lesson
For npm publish readiness, verify the real packed artifact. Run `npm pack --json`, inspect the packed file list, install the resulting `.tgz` into a temporary consumer, then verify both runtime import and `tsc --noEmit` type resolution against the packed package.

## When to Apply
Apply this rule whenever a package is being prepared for first publish, metadata is being changed, or published type surfaces may still depend on external packages.
