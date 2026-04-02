import { DEFAULT_COMPLETION_PROMISE, DEFAULT_MAX_ITERATIONS_FALLBACK } from "../ralph-loop/constants.js"

export type CommandDefinition = {
  name: string
  description: string
  template: string
}

const RALPH_LOOP_TEMPLATE = `You are starting a Ralph Loop - a self-referential development loop that runs until task completion.

## How Ralph Loop Works

1. You will work on the task continuously
2. When you believe the task is FULLY complete, output the configured completion promise exactly as provided
3. If you don't output the promise, the loop will automatically inject another prompt to continue
4. Maximum iterations: plugin config fallback (${DEFAULT_MAX_ITERATIONS_FALLBACK})

## Rules

- Focus on completing the task fully, not partially
- Don't output the completion promise until the task is truly done
- Each iteration should make meaningful progress toward the goal
- If stuck, try different approaches
- Use todos to track your progress

## Exit Conditions

1. **Completion**: Output your completion promise when fully complete
2. **Max Iterations**: Loop stops automatically at limit
3. **Cancel**: User runs \`/cancel-ralph\` command

## Your Task

Parse the arguments below and begin working on the task. The format is:
\`[--completion-promise=TEXT] [--max-iterations=N] [--strategy=continue] task description\`

Aliases: \`--promise "TEXT"\`, \`--max N\`
Reset strategy is not supported in v1.

Default completion promise is the project default \`${DEFAULT_COMPLETION_PROMISE}\` and default max iterations follows the plugin config fallback (${DEFAULT_MAX_ITERATIONS_FALLBACK}).`

const CANCEL_RALPH_TEMPLATE = `Cancel the currently active Ralph Loop.

This will:
1. Stop the loop from continuing
2. Clear the loop state file
3. Allow the session to end normally

Check if a loop is active and cancel it. Inform the user of the result.`

export function getBuiltinCommands(): Record<string, CommandDefinition> {
  return {
    "just-loop": {
      name: "just-loop",
      description: "(builtin) Start self-referential development loop until completion",
      template: `<command-instruction>
${RALPH_LOOP_TEMPLATE}
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
    },
    "cancel-ralph": {
      name: "cancel-ralph",
      description: "(builtin) Cancel active Ralph Loop",
      template: `<command-instruction>
${CANCEL_RALPH_TEMPLATE}
</command-instruction>`,
    },
  }
}
