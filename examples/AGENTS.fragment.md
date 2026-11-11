# Deploy checks (paste into your app’s AGENTS.md)

This app uses [deploy-check](https://github.com/Majiturbo/deploy-check) for evidence before saying “it’s live”.

Full contract: copy or link `docs/rules/deploy-check.md` from that repository (or vendor a copy).

Hard rules (summary):

1. Never clear the working tree for deploy with `git stash` / `git checkout --` / `git restore` / `git reset --hard` / `git clean -f`.
2. Deploy only an **explicit, pushed** git SHA.
3. Before saying “live”, run verify and check every unit in this repo’s `deploy-units.json`.
4. **Must** call MCP `deploy_check_direction` (or `npx @majiturbo/deploy-check direction`) before the first edit on a new task (`moment: start`), and again on a turn before continuing the old path. A failed or skipped call means stop that path.
5. **Must** call MCP `deploy_check_loop` (or `npx @majiturbo/deploy-check loop`) before saying a repeated fix is done. If it trips, switch approach class. Do not say “fixed” inside the class already tried.
6. **Must** call MCP `deploy_check_done` (or `npx @majiturbo/deploy-check done`) before saying done / tests pass / fixed after edits. Do not delete or skip tests to go green.
7. Prefer the MCP tools over shell for direction/loop/done so the required fields stay in the tool schema.

Commands (from this app repo):

```bash
npx @majiturbo/deploy-check --cwd . --shadow
npx @majiturbo/deploy-check verify --cwd .
```

If the MCP server `deploy-check` is configured, call `deploy_check_pre` before deploy-shaped shell commands and `deploy_check_verify` after deploy. Prefer naming the units you actually shipped over a blanket “everything is live”.
