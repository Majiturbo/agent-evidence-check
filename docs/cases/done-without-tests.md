# Done: “green” / “done” with no test receipt

- Module: done (`agent-evidence-check done` / `deploy_check_done`)
- Role: motivating case for `done_evidence` and `tests_untampered`

## Pattern

After edits, the agent says the work is done or the tests are green. There is no recorded `testCommand` exit code 0 — or the suite was made green by deleting failing tests, adding `skip`, or asserting a constant true.

A third party (or a later session) cannot tell whether “done” means verified or merely asserted.

## What the check should say

> Do not say done / tests pass / fixed without a recorded exit code 0. If the uncommitted test diff deletes tests or hollows assertions, restore the tests or fix the code under test.

## Mapping

- `done_evidence` — require green exit on the record
- `tests_untampered` — reject delete / wash patterns in uncommitted test diffs
- Optional `doneGate` when configured
- Contract: [`docs/judgments.md`](../judgments.md)
