# deploy-check

[中文说明](./README.zh-CN.md)

**Evidence before an agent may treat a judgment as settled** — direction, “fixed,” “tests green,” or “it’s live.” Not every-message premise middleware.

If you run coding agents and keep hearing confident claims with nothing on the record, this library is for you.

| Judgment | Failure mode | Evidence | How |
|---|---|---|---|
| Direction | Obeys the prompt; skips fake need / substitute / nearer path | Goal, current path, a **different** nearer path, why not that, one fact | CLI / MCP `direction`; optional Stop gate |
| Loop | Same class of fix; still says “fixed” | Edit / rejection counts; next step must leave that class | CLI / MCP `loop`; optional Stop / edit gates |
| Done | Claims done / green after edits | Green `testCommand` exit; uncommitted test diff not washed | CLI / MCP `done`; optional `doneGate` |
| Deploy | Claims “live” after stash, partial ship, or hot-patch | Clean tree, explicit SHA, pushed, units match observe | Shell hooks + CLI / MCP `pre` / `verify` |

The package name is historical (deploy hooks came first). The product is the four judgments above. Direction, loop, and done **do not scrape chat** — the caller (or the agent via MCP) submits the record.

## Try it (90 seconds)

From a checkout of this repo (Node ≥ 22):

```bash
npm test
node bin/check-deploy.mjs init --cwd /tmp/sample-app

# nearer path identical to current path → blocked
node bin/check-deploy.mjs direction --cwd /tmp/sample-app \
  --moment start --goal 'speed up the slow page' \
  --path 'rewrite the renderer' \
  --nearer 'rewrite the renderer' \
  --why 'keep going' --evidence 'user said the page is slow'

# same approach class + "fixed" → blocked
node bin/check-deploy.mjs loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried 'tweak CSS' --next 'tweak CSS'

# no green test on the record → blocked
node bin/check-deploy.mjs done --cwd /tmp/sample-app --no-run --exit-code 1
```

Trimmed `direction` finding (advisory mode still returns `allow: true`; open gates to enforce):

```json
{
  "ok": false,
  "findings": [{
    "checkId": "direction_review",
    "severity": "block",
    "premise": "Continuing the current path is justified without writing down another one",
    "evidence": "nearer path is the same as the current path"
  }]
}
```

Pass by naming a **different** nearer path / next class, or a green exit code. Contract: [`docs/judgments.md`](docs/judgments.md).

## Use it in an app repo

```bash
node bin/check-deploy.mjs init --cwd /path/to/your-app
node bin/check-deploy.mjs doctor --cwd /path/to/your-app
npm run install-hooks    # optional; user-level, no-ops without deploy-units.json
```

Hard gates (Stop / edit / done) after enroll:

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true }
```

Consumer rules: [`docs/rules/deploy-check.md`](docs/rules/deploy-check.md). Undo hooks: `node scripts/install-hooks.mjs --uninstall`.

**MCP:** `node bin/deploy-check-mcp.mjs` — tools `deploy_check_direction` / `_loop` / `_done` / `_pre` / `_verify`. Pass `{ "cwd": "/path/to/your-app" }`. See [`docs/mcp.md`](docs/mcp.md).

**After npm publish** (run from *outside* this clone — inside the repo `npx` resolves the local package and has no `.bin` link):

```bash
cd /tmp
npx @majiturbo/deploy-check --help
npx -p @majiturbo/deploy-check deploy-check-install-hooks
npx -p @majiturbo/deploy-check deploy-check-mcp
```

From a checkout of this repo use `node bin/check-deploy.mjs …` instead.

Status: **v0.1, experimental.** macOS / Linux / Windows (`node` on `PATH`). English UX by default; `"lang": "zh"` or `DEPLOY_CHECK_LANG=zh`. Trial with `DEPLOY_CHECK_MODE=shadow`. Host UI may need a one-time enable — [`docs/hook-setup.md`](docs/hook-setup.md).

## What you get

| Piece | Role |
|---|---|
| `deploy-units.json` in *your* app | Opt-in enrollment; units, `done` / `loop` / `judgments` |
| CLI `deploy-check` | `direction`, `loop`, `done`, `pre-deploy`, `verify`, `init`, `doctor` |
| `deploy-check-mcp` | Same five judgment tools over stdio MCP |
| `hooks/bridge.mjs` + `hooks/run.sh` | Deploy shell bridge; optional Stop / edit gates |
| [`docs/adapters.md`](docs/adapters.md) | Hook matrix (Cursor, Claude Code, Codex, Trae, Copilot, Qoder, DSH) |

Default mode is **advisory**. It does **not** replace CI, GitOps, or vendor sandboxes. Prefer worktrees + push + pipeline for release; use this when agents still claim outcomes without a receipt.

## Checks (closed registry)

Agents may only select these ids—they cannot invent check names.

**Direction / loop / done** (CLI or MCP only)

- `direction_review` — before sinking work: force a record that names a nearer/substitute path  
- `loop_escape` — when thresholds trip, next step must leave the failed approach class  
- `done_evidence` — recorded test exit code 0 before saying done  
- `tests_untampered` — uncommitted test diff must not delete tests or add skip / assert-true washes  

**Deploy** (shell hooks + `pre` / `verify`)

- `dirty_tree` — dirty worktree; **forbids stash/checkout clearing**  
- `deploy_from_commit` / `unpushed` — explicit SHA on a remote-tracking branch  
- `units_declared` / `units_match` — declared units; post-deploy observe matches  
- `hotpatch_drift` — host drift must return to git  

Observe / `verify`: [`docs/verify.md`](docs/verify.md). Custom checks: `custom:` prefix only.

## Non-goals

- Semantic premise interception on every message  
- Replacing vendor shell sandboxes / Auto-review  
- Invented token-savings or anti-loop marketing numbers  
- Claiming a host without a documented hook + smoke (see the matrix)

## Evidence / contributing

Pattern cases (portable, no private hosts): [`docs/cases/`](docs/cases/) — direction, repair loop, done-without-tests, cross-tool stash, partial deploy. ADRs: [`docs/decisions/`](docs/decisions/). Human contributors: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
