/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

describe("package metadata", () => {
  it("matches npm publish readiness requirements", async () => {
    const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url))
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"))

    expect(packageJson.name).toBe("@w32191/just-loop")
    expect("private" in packageJson).toBe(false)
    expect("bin" in packageJson).toBe(false)
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
    expect(packageJson.description).toBe("OpenCode plugin package for just-loop.")
    expect(packageJson.type).toBe("module")
    expect(packageJson.license).toBe("MIT")
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "https://github.com/SamWang32191/just-loop",
    })
    expect(packageJson.main).toBe("./dist/src/index.js")
    expect(packageJson.types).toBe("./dist/src/index.d.ts")
    expect(packageJson.exports["."].import).toBe("./dist/src/index.js")
    expect(packageJson.exports["."].types).toBe("./dist/src/index.d.ts")
    expect(packageJson.publishConfig).toEqual({ access: "public" })
    expect(packageJson.engines.node).toBe(">=20")
    expect(packageJson.files).toEqual(["dist/", "README.md", "LICENSE"])
    expect(packageJson.scripts.build).toBe("tsc -p tsconfig.json")
    expect(packageJson.scripts.typecheck).toBe("tsc --noEmit")
    expect(packageJson.scripts.test).toBe("bun run build && bun test")
    expect(packageJson.scripts["smoke:pack"]).toBe("node scripts/smoke-pack.mjs")
    expect(packageJson.scripts["verify:publish"]).toBe(
      "npm run build && npm run test && node scripts/verify-publish.mjs",
    )
    expect(packageJson.scripts.prepublishOnly).toBe("npm run verify:publish")
  })
})
