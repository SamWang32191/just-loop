import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

describe("package entry", () => {
  it("declares loadable main and exports for dist/src/index.js", async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dir, "..", "package.json"), "utf8"))
    expect(packageJson.main).toBe("./dist/src/index.js")
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/src/index.d.ts",
        import: "./dist/src/index.js",
      },
    })
  })

  it("build output exposes an importable ESM entry with declarations", async () => {
    const distEntry = join(import.meta.dir, "..", "dist", "src", "index.js")
    const distTypes = join(import.meta.dir, "..", "dist", "src", "index.d.ts")

    expect(await Bun.file(distTypes).exists()).toBe(true)
    await expect(import(distEntry)).resolves.toBeTruthy()
  })
})
