# Direction: sunk cost without a nearer path on the record

- Module: direction (`agent-evidence-check direction` / `deploy_check_direction`)
- Role: motivating case for `direction_review` at start / turn

## Pattern

The user asks for an outcome (“make it faster,” “add the feature”). The agent picks a heavy path (rewrite a subsystem, hand-roll a capability) and starts editing. It never writes down a cheaper substitute (profile first, reuse an existing module, change config, drop scope) or a fact that rules that substitute out.

Later the same session discovers the heavy path was unnecessary — or the user already had a nearer path in mind. The failure is not “the agent chose wrong”; it is that **no alternative nearer path was on the record** before work sank.

## What the check should say

> Before continuing: name the goal, the current path, a different nearer path, why you take or reject it, and one fact. Do not treat a rephrase of the current path as the alternative.

## Mapping

- `direction_review`
- Optional Stop gate when `judgments.stopGate` is on
- Contract: [`docs/judgments.md`](../judgments.md)
