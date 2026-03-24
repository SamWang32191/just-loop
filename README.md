# @w32191/just-loop

OpenCode plugin package for just-loop.

## Requirements

- Node 20+

## Install

```bash
npm install @w32191/just-loop
```

## Usage

Put this in your OpenCode plugin entry or config file:

```ts
import justLoop from "@w32191/just-loop"

export default justLoop
```

This package is intended for OpenCode plugin usage.

## Publishing notes

Bun is only a maintenance and release prerequisite. It is not a runtime dependency for normal installers.

## Release

Prerequisites: Node 20+, Bun, and a valid npm login/token.

1. Run `npm login`.
2. Run `npm whoami`.
3. Confirm `@w32191` scope access with `npm access list packages @w32191` (or equivalent access check).
4. Run `npm view @w32191/just-loop version`.
   - For the first publish, a 404 is expected until the package exists.
   - The real unblock condition is: `npm whoami` succeeds and scope access checks pass.
5. Bump the package version.
6. Run `npm run verify:publish`.
7. Publish with `npm publish --access public`.
