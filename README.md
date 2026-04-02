# @w32191/just-loop

OpenCode plugin package for just-loop.

## Requirements

- Node 20+

## Usage

在 `opencode.json` 的 `plugin` 欄位加入 plugin 名稱即可載入：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@w32191/just-loop"]
}
```

依官方文件，`opencode.json` 放在專案根目錄（專案設定）或 `~/.config/opencode/opencode.json`（全域設定）皆可，OpenCode 會在啟動時自動安裝與載入 npm 套件型 plugin。

## Publishing notes

Bun is only a maintenance and release prerequisite. It is not a runtime dependency for normal installers.

## Release

Primary release flow uses GitHub Actions and only allows manual dispatch from `main`.

### GitHub Actions release

Prerequisites:

- GitHub Actions release workflow is configured in this repository
- npm Trusted Publisher is configured for this package

Steps:

1. Open the `Release` workflow in GitHub Actions from the `main` branch.
2. Choose either:
   - `auto-bump = patch|minor`, or
   - `auto-bump = no` and provide `version = X.Y.Z`
3. Optionally add one-line `notes`.
4. Optionally set `dry_run = true` to validate without pushing, tagging, or publishing.

The workflow will:

1. Lock to the dispatched `main` commit SHA.
2. Install dependencies with `bun install --frozen-lockfile`.
3. Update `package.json` to the release version.
4. Run `npm run verify:publish`.
5. Generate a release notes artifact.
6. On non-dry-run:
   - commit the version bump to `main`
   - create and push tag `vX.Y.Z`
   - publish to npm with `npm publish --provenance --access public`
   - create the GitHub Release

### Local fallback

If GitHub Actions is unavailable, the equivalent manual flow is:

1. Bump the package version.
2. Run `npm run verify:publish`.
3. Publish with `npm publish --access public`.
