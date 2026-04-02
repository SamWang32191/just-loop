## 1. Countdown runtime update

- [x] 1.1 Change the Ralph Loop continuation countdown constant from 5 seconds to 10 seconds so the existing wait flow uses the new delay.
- [x] 1.2 Review the countdown-related runtime messaging and assertions in core logic to ensure all user-visible countdown references align with the 10-second window.

## 2. Verification

- [x] 2.1 Update Ralph Loop tests that currently expect a 5-second wait or a 5→4→3→2→1 toast sequence so they validate the 10-second behavior instead.
- [x] 2.2 Run the relevant Ralph Loop test coverage to confirm delayed injection, countdown toasts, and one-shot cancellation still behave correctly with the longer countdown.
