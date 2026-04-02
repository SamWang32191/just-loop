## Purpose

Define the pending prompt-injection countdown behavior for Ralph Loop, including user-visible toast updates and one-shot cancellation.

## Requirements

### Requirement: Continuation injection SHALL wait for a 5-second countdown
When an active Ralph Loop determines that another continuation prompt is required, the system SHALL wait 5 seconds before sending that continuation prompt.

#### Scenario: Continuation is injected after the countdown elapses
- **WHEN** a `session.idle` event finds new assistant output, the completion promise is not satisfied, and the loop has remaining iterations
- **THEN** the system enters a pending continuation countdown for 5 seconds
- **AND** the system sends the continuation prompt only after that countdown completes

#### Scenario: Countdown start is visible to the user
- **WHEN** a pending continuation countdown begins
- **THEN** the system SHALL show a TUI toast that indicates continuation is pending
- **AND** the toast SHALL explain that the next injection can be cancelled during the countdown window

#### Scenario: Countdown toast updates every second
- **WHEN** a 5-second pending continuation countdown is active
- **THEN** the system SHALL update the TUI toast once per second to reflect the remaining countdown
- **AND** the visible countdown sequence SHALL cover 5, 4, 3, 2, and 1 seconds before injection occurs

#### Scenario: Duplicate idle events do not create duplicate countdowns
- **WHEN** a continuation countdown is already pending for the active loop and another `session.idle` event arrives for the same loop
- **THEN** the system MUST NOT schedule or send an additional continuation prompt for that same assistant batch

### Requirement: Users SHALL be able to cancel the pending next injection once
The system SHALL allow the existing interrupt control to cancel a pending continuation injection without cancelling the active Ralph Loop.

#### Scenario: Interrupt during countdown suppresses the pending prompt
- **WHEN** a `session.interrupt` event is received while a continuation countdown is pending
- **THEN** the system MUST NOT send the pending continuation prompt
- **AND** the loop remains active at the current iteration
- **AND** the system SHALL notify the user that the pending injection was cancelled

#### Scenario: Loop cleanup during countdown prevents injection
- **WHEN** the active loop is cancelled, deleted, errors, or otherwise cleared before the countdown completes
- **THEN** the system MUST NOT send the pending continuation prompt
- **AND** the pending countdown state is cleared

### Requirement: Pending-injection cancellation SHALL be one-shot
Cancelling a pending continuation injection SHALL only affect the currently pending next injection and MUST NOT permanently disable future continuation prompts.

#### Scenario: A later continuation can still run after one cancellation
- **WHEN** one pending continuation was suppressed by interrupt and a later assistant batch again requires continuation
- **THEN** the system SHALL start a fresh 5-second countdown for that later continuation
- **AND** the system SHALL send that later continuation prompt if it is not cancelled
