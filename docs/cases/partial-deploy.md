# Partial deploy: “it’s live” when only one unit shipped

- Module: deploy verification
- Role: motivating case for `units_declared` / `units_match`

## Pattern

An agent announces that a change is live. Users still see the old behavior.

Root cause: production is more than one deploy unit. A common shape is an **API container image** plus **host static files**. The agent rebuilt and restarted only the API unit; the static unit never changed. Saying “live” after one unit shipped is a judgment without a full receipt.

Related failure in the same class: a secret or flag was hot-patched on the host; local `.env` edits were treated as deployed. The reply never separated “edited locally” from “deployed and verified.”

## What the check should say

> Prefer preview until the change stabilizes.  
> If shipping: list every deploy unit and show target → observed for each.  
> Do not say “live” until every declared unit matches.

## Mapping

- `units_declared` / `units_match`
- Progress ladder: local → commit → push → deploy(units) → verify(evidence)
- Production deploy = interrupt; preview can stay advisory
- Observe types: [`docs/verify.md`](../verify.md)
