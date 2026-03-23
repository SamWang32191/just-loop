# Rename project to `just-loop` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project to `just-loop` across package metadata, repo documentation, and the local root directory without changing runtime behavior.

**Architecture:** This change is metadata-and-docs only. Update all in-repo text references first while the workspace is still at the old path, verify no source or test code needs behavior changes, then rename the repository root directory and rerun verification from the new path.

**Tech Stack:** Bun, TypeScript, OpenCode/OpenSpec docs, git working tree on macOS

---

## File Structure / Responsibility Map

- `package.json` — canonical npm/package name
- `bun.lock` — Bun workspace/package metadata snapshot
- `findings.md` — research notes mentioning the project name
- `task_plan.md` — prior planning notes mentioning the project name
- `progress.md` — prior progress log mentioning the project name
- `docs/superpowers/plans/2026-03-23-ralph-loop-implementation.md` — existing implementation plan with old project name references
- `docs/superpowers/specs/2026-03-23-ralph-loop-design.md` — existing design spec with old project name references
- `docs/lessons/ralph-loop-state-store-path.md` — lesson card that mentions the project name while preserving the `.loop/ralph-loop.local.md` path rule
- the approved rename spec file — content must also be updated to avoid the old project name string
- this implementation plan file — its content must also be updated to avoid the old project name string during execution
- repo root directory renamed to `just-loop` — local workspace path only, performed after file edits

## Implementation Notes

- Do not change any runtime identifiers beyond the package name unless a verified repo search proves they still contain the old project name.
- Do not modify `src/**`, `tests/**`, or `openspec/config.yaml` unless verification finds an actual old-name match there.
- Preserve the Ralph Loop persisted state path `.loop/ralph-loop.local.md` exactly.
- Do not create a git commit unless the user explicitly asks.
- After the root directory rename, every command must run from the new absolute path.

### Task 1: Confirm the exact rename surface before editing

**Files:**
- Inspect: `package.json`
- Inspect: `bun.lock`
- Inspect: `findings.md`
- Inspect: `task_plan.md`
- Inspect: `progress.md`
- Inspect: `docs/superpowers/plans/2026-03-23-ralph-loop-implementation.md`
- Inspect: `docs/superpowers/specs/2026-03-23-ralph-loop-design.md`
- Inspect: `docs/lessons/ralph-loop-state-store-path.md`
- Inspect: the rename design spec file
- Inspect: this rename implementation plan file

- [ ] **Step 1: Search the repo for current old-name references**

Run: content search for the old project name across the repo, excluding `.git/**`.
Expected: matches in package metadata and docs only.

- [ ] **Step 2: Search the repo for any existing `just-loop` references**

Run: content search for `just-loop` across the repo, excluding `.git/**`.
Expected: either zero matches or only intentional preexisting references.

- [ ] **Step 3: Check whether any file path or directory path inside the repo already contains the old project name**

Run: file path glob/search for names containing the old project name.
Expected: no nested file or directory names inside the repo; only the repo root directory uses the old name.

- [ ] **Step 4: Record the final edit list before touching files**

Expected final edit list:

```text
package.json
bun.lock
findings.md
task_plan.md
progress.md
docs/superpowers/plans/2026-03-23-ralph-loop-implementation.md
docs/superpowers/specs/2026-03-23-ralph-loop-design.md
docs/lessons/ralph-loop-state-store-path.md
the rename design spec file
this rename implementation plan file
```

### Task 2: Rename package metadata and documentation references

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `findings.md`
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `docs/superpowers/plans/2026-03-23-ralph-loop-implementation.md`
- Modify: `docs/superpowers/specs/2026-03-23-ralph-loop-design.md`
- Modify: `docs/lessons/ralph-loop-state-store-path.md`
- Modify: `the rename design spec file`
- Modify: `this rename implementation plan file`

- [ ] **Step 1: Update `package.json` package name**

Change:

```json
{
  "name": "<old-project-name>"
}
```

to:

```json
{
  "name": "just-loop"
}
```

- [ ] **Step 2: Update `bun.lock` workspace/package name**

Replace the lockfile occurrence of the old project name with `just-loop` and keep the change minimal.
Expected: only the package/workspace name changes; no unrelated lockfile churn.

- [ ] **Step 3: Update plain-text docs and planning files**

Replace the old project name with `just-loop` in the listed markdown files.
Preserve all non-name content unless a sentence becomes grammatically incorrect and needs a minimal wording fix.
This includes updating this implementation plan's own content while keeping its filename unchanged.

- [ ] **Step 4: Re-read the lesson file to verify the state path constraint survived the rename**

Check that this exact string is still present after edits:

```text
.loop/ralph-loop.local.md
```

Expected: project name changes, persisted state path does not.

- [ ] **Step 5: Run a repo search for the old project name before directory rename**

Run: content search for the old project name across the repo, excluding `.git/**`.
Expected: zero matches in tracked workspace files.

### Task 3: Verify no source/test behavior changes are needed

**Files:**
- Inspect: `src/**`
- Inspect: `tests/**`
- Inspect: `openspec/config.yaml`

- [ ] **Step 1: Search `src/**` for the old project name**

Expected: zero matches.

- [ ] **Step 2: Search `tests/**` for the old project name**

Expected: zero matches.

- [ ] **Step 3: Search `openspec/config.yaml` for the old project name**

Expected: zero matches.

- [ ] **Step 4: If any unexpected match appears, stop and update the plan/spec before editing behavior-related files**

Expected: no stop required.

### Task 4: Rename the local repository root directory

**Files:**
- Rename the repository root to `/Users/samwang/tmp/workspace/just-loop`

- [ ] **Step 1: Verify the parent directory exists before rename**

Run: list `/Users/samwang/tmp/workspace`
Expected: confirm the current repo directory exists as a child of that directory.

- [ ] **Step 2: Rename the root directory**

Run:

```bash
mv "<current-repo-path>" "/Users/samwang/tmp/workspace/just-loop"
```

Expected: command succeeds with no output.

- [ ] **Step 3: Verify the new directory exists and the old one no longer does**

Run: list `/Users/samwang/tmp/workspace`
Expected: `just-loop` exists and the old root directory name no longer does.

- [ ] **Step 4: Switch all subsequent operations to the new path**

New working directory:

```text
/Users/samwang/tmp/workspace/just-loop
```

### Task 5: Run verification from the new path

**Files:**
- Verify from: `/Users/samwang/tmp/workspace/just-loop`

- [ ] **Step 1: Search the renamed repo for the old project name**

Run: content search for the old project name across `/Users/samwang/tmp/workspace/just-loop`, excluding `.git/**`.
Expected: zero matches.

- [ ] **Step 2: Search the renamed repo for `just-loop`**

Run: content search for `just-loop` across `/Users/samwang/tmp/workspace/just-loop`, excluding `.git/**`.
Expected: matches in `package.json`, `bun.lock`, and the updated docs.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 4: Run build**

Run: `bun run build`
Expected: exit 0.

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: existing test suite passes.

- [ ] **Step 6: Inspect git status**

Run: `git status --short`
Expected: only the intended file content edits. The local root directory rename changes the filesystem path used for commands, but does not appear as an in-repo path rename in `git status`.

### Task 6: Final handoff checks

**Files:**
- Review: edited files from Tasks 2 and 4

- [ ] **Step 1: Confirm success criteria against the spec**

Checklist:

```text
[ ] package name is just-loop
[ ] bun.lock uses just-loop
[ ] repo docs no longer mention the old project name
[ ] state path still uses .loop/ralph-loop.local.md
[ ] repo root directory is just-loop
[ ] typecheck passed
[ ] build passed
[ ] tests passed
```

- [ ] **Step 2: Do not commit unless the user explicitly asks**

Expected: leave the working tree uncommitted by default.

- [ ] **Step 3: Report the new workspace path and verification evidence to the user**

Expected report includes:
- new path `/Users/samwang/tmp/workspace/just-loop`
- search results summary
- build/typecheck/test outcomes
- note that no git commit was created
