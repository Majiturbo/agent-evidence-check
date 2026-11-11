# Repair loop: same approach class, still “fixed”

- Module: loop escape (`agent-evidence-check loop` / `deploy_check_loop`)
- Role: why the card needs “leave this class + name an alternative,” not only “are you sure?”

## Pattern

A polish or bugfix runs for many turns on the same file. The user keeps rejecting the result. The agent stays inside one family of fixes (for example repeated CSS tweaks) and keeps claiming the issue is fixed, instead of switching class (measure first, change data path, drop the feature, ask which tradeoff to take).

The check does **not** read the chat. The caller passes edit count, rejection count, the class already tried, and the next class. Passing requires the next step to be a different class, listed in the alternatives.

## What the check should say

> Edits and rejections already trip the loop threshold. Do not say “fixed” while the next step is still the same approach class. Name a different class, narrow the claim, or stop and ask.

## Mapping

- `loop_escape`
- Optional Stop / edit gates when `judgments.editGate` / `stopGate` are on
- Contract: [`docs/judgments.md`](../judgments.md)
