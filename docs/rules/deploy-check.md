# Deploy checks (tool-agnostic; link from every agent's `AGENTS.md`)

[中文版](./deploy-check.zh-CN.md)

These rules do not depend on any IDE. Where a host has hooks (Cursor, Claude Code, Codex, Trae, Copilot, Qoder, DSH), the hook is the enforcement layer; **this file is the minimum contract for every tool**.

## Hard rules

1. **Never** clear the working tree for a deploy with `git stash` / `git checkout --` / `git restore` / `git reset --hard` / `git clean -f`. Files you did not change may be uncommitted work from another tool or session.
2. Deploy only from an **explicit, pushed git SHA**, never from "the current working tree".
3. Before saying "it's live", verify every unit in the repo's `deploy-units.json`. If any unit is unverified, say "updated: &lt;units&gt;", not "everything is live".
4. Hot patches (editing host files or production env directly) must go back to git, and the reply must state progress on this ladder:

   `local change → committed (SHA) → pushed → deployed (units…) → verified (evidence…)`

5. Before deploying, if available, run:

   ```bash
   npx @majiturbo/deploy-check --cwd . --shadow
   # or: node /path/to/deploy-check/bin/check-deploy.mjs --cwd . --shadow
   ```

   Resolve any `block` findings before continuing.

6. After deploying, before saying "it's live", run:

   ```bash
   npx @majiturbo/deploy-check verify --cwd .
   ```

   Each unit needs either an `observe` block in `deploy-units.json` or evidence passed via `--observed`. Partial deploys must name the units that actually changed.

7. At the **start** of a task, and at a **turn** (the user changes the goal, rejects the approach, or a shorter path shows up), **you must** call direction review **before the first edit / before continuing the old path**. Prefer MCP `deploy_check_direction`. Pass the goal, the current path, a different nearer path, why you are or are not taking it, and one fact. A skipped or failing call means stop that path. Details: [`docs/judgments.md`](../judgments.md).

   ```bash
   npx @majiturbo/deploy-check direction --cwd . --moment start --goal "…" --path "…" --nearer "…" --why "…" --evidence "…"
   ```

8. Before saying a repeated fix is **done**, **you must** call loop escape (prefer MCP `deploy_check_loop`) with the target, edit count, rejection count, the approach class already tried, and the next class. If it trips, the next step must be a different class. Do not say “fixed” while staying in the class already tried.

   ```bash
   npx @majiturbo/deploy-check loop --cwd . --target FILE --edits N --rejections N --tried "…" --next "…" --alternative "…"
   ```

   These two are not on the deploy shell hook. How to harden further (Stop hooks, edit gates): [`docs/judgments.md`](../judgments.md#how-to-make-the-agent-actually-call-them).

9. Before saying **done / fixed / tests pass** after edits, **you must** call done evidence (prefer MCP `deploy_check_done`). It runs `done.testCommand` and rejects obvious testwashing in the uncommitted test diff.

   ```bash
   npx @majiturbo/deploy-check done --cwd .
   ```

## Shorter paths

- Parallel agents: one **git worktree / branch** each; merge, then ship.
- With CI: commit and push, let the pipeline deploy; agents should avoid `ssh`-ing to production from a dev machine.
