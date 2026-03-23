import type { Plugin } from "@opencode-ai/plugin"
import { createPlugin } from "./plugin/create-plugin.js"

const plugin: Plugin = (ctx) => createPlugin(ctx)

export default plugin
