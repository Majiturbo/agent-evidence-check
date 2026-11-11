# Cross-tool stash wiping parallel work

- Module: deploy verification
- Role: motivating case for `dirty_tree` (forbidding stash/checkout to “clear” before deploy)

## Pattern

When two coding agents (or two sessions) share one working tree, deploy-time “unrelated dirty files” are often the other agent’s unfinished work. A common agent script:

1. `git stash push -u -m "wip before deploy"`
2. deploy
3. `git stash pop || true` (treat failure as success)

Also seen: `git checkout -- <file>` / `git restore` to discard local changes before shipping.

The mechanism is dangerous even when most stashes are later recovered: untracked files can vanish from HEAD, the working tree, and reachable blobs. Separate worktrees per agent avoid the conflict class entirely.

## What the check should do

- On a dirty tree: block deploy-shaped commands; **forbid** stash / hard reset / clean / checkout-discard as the fix.
- Suggest: commit or move the changes, deploy an explicit pushed SHA, or use a separate worktree per agent.

## Mapping

- `dirty_tree` (+ clear detectors)
- Related: `deploy_from_commit`, `unpushed`
