# Changelog

## 0.1.1 — 2026-11-11

- Richer README (badges, features, worked examples, docs index) and clearer opening copy  
- Discoverability: GitHub About / topics, npm keywords (`ai-agent`, `agent-hooks`, `repair-loop`, `test-wash`, …)  
- Docs: drop public ADRs; keep portable `docs/cases/`  
- Note: run `npx` outside this clone (local package has no `.bin` link)

## 0.1.0 — 2026-11-11

First public cut: evidence-backed deploy checks for coding agents.

npm package is **`@majiturbo/deploy-check`** (unscoped `deploy-check` is already taken on the registry). CLI bin names stay `deploy-check` / `deploy-check-mcp` / `deploy-check-install-hooks`.

- Closed-registry checks: `dirty_tree`, `deploy_from_commit`, `unpushed`, `units_declared`, `units_match`, `hotpatch_drift`, `direction_review`, `loop_escape`, `done_evidence`, `tests_untampered`
- CLI: `deploy-check` (pre-deploy), `verify`, `direction`, `loop`, `done`, `init`, `doctor`
- Hooks bridge for Cursor, Claude Code, Codex, Trae, Copilot, Qoder, DSH (+ `install-hooks` / `--uninstall`)
- Per-repo opt-in via `deploy-units.json`; portable `hooks/run.sh` and Windows `node "…/bridge.mjs"`
- Post-deploy observe: `http_json`, `http_text`, `file_sha256`, `command`, `literal`
- MCP stdio server: `deploy_check_pre`, `deploy_check_verify`, `deploy_check_direction`, `deploy_check_loop`, `deploy_check_done`
- Direction / loop / done: explicit CLI/MCP calls. The caller supplies the record. Not on the shell hook. See `docs/judgments.md`
- Optional judgment gates (`judgments.stopGate` / `editGate` / `doneGate`): session receipts in `.deploy-check/`, Claude `Stop` + Edit deny, Cursor `stop` follow-up + edit `preToolUse`
- Done evidence: green `done.testCommand` + uncommitted test-diff wash scan — the gap vendors’ sandboxes do not close
- English default UX; Chinese via `"lang": "zh"` / `DEPLOY_CHECK_LANG`
