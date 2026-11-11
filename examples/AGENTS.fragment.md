# Agent evidence checks (paste into your app’s AGENTS.md)

This app uses [agent-evidence-check](https://github.com/Majiturbo/agent-evidence-check) for evidence before saying “it’s live”.

Full contract: copy or link `docs/rules/agent-evidence-check.md` from that repository (or vendor a copy).

Hard rules (summary):

1. Never clear the working tree for deploy with `git stash` / `git checkout --` / `git restore` / `git reset --hard` / `git clean -f`.
2. Deploy only an **explicit, pushed** git SHA.
3. Before saying “live”, run verify and check every unit in this repo’s `deploy-units.json`.
4. **Must** call MCP `deploy_check_direction` (or `npx agent-evidence-check direction`) before the first edit on a new task (`moment: start`), and again on a turn before continuing the old path. A failed or skipped call means stop that path.
5. **Must** call MCP `deploy_check_loop` (or `npx agent-evidence-check loop`) before saying a repeated fix is done. If it trips, switch approach class. Do not say “fixed” inside the class already tried.
6. **Must** call MCP `deploy_check_done` (or `npx agent-evidence-check done`) before saying done / tests pass / fixed after edits. Do not delete or skip tests to go green.
7. Prefer the MCP tools over shell for direction/loop/done so the required fields stay in the tool schema.

Commands (from this app repo):

```bash
npx agent-evidence-check --cwd . --shadow
npx agent-evidence-check verify --cwd .
```

If the MCP server `agent-evidence-check` is configured, call `deploy_check_pre` before deploy-shaped shell commands and `deploy_check_verify` after deploy. Prefer naming the units you actually shipped over a blanket “everything is live”.
