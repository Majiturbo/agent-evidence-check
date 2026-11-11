# deploy-check

[中文说明](./README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/@majiturbo/deploy-check.svg)](https://www.npmjs.com/package/@majiturbo/deploy-check)
[![CI](https://github.com/Majiturbo/deploy-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Majiturbo/deploy-check/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/@majiturbo/deploy-check.svg)](https://www.npmjs.com/package/@majiturbo/deploy-check)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Coding agents treat “right direction / fixed / tests green / it’s live” as settled facts, while the worktree, test exit code, and live units often hold no receipt. Vendor sandboxes stop dangerous commands; **deploy-check** stops **judgments without evidence**—closed-registry checks at four moments, not semantic interrogation on every message.

In day-to-day use the model sounds confident: it follows the prompt without naming a nearer path, stays in one failing approach class for eight edits and still says “fixed,” claims green without a recorded exit `0`, or ships one unit and announces the whole surface is live. That is not a permissions miss—it is **the conclusion arriving before the evidence**.

This library is CLI + MCP (same tools) plus optional thin hooks for direction, loop, done, and deploy. It does **not** scrape chat and is **not** premise middleware on every message. The caller (or the agent via MCP) submits the record; the checks only ask whether the receipt holds.

| They say | What’s missing |
|---|---|
| “I’ll just follow the prompt.” | A nearer / cheaper path written down |
| “Fixed.” | Leaving the approach class that already failed |
| “Tests are green / we’re done.” | A recorded exit code `0` (tests not washed) |
| “It’s live.” | Clean tree, pushed SHA, every unit matches observe |

## Who this is for

- You run **Cursor / Claude Code / Codex** (or similar) agents and get confident “done / fixed / live” claims without a record  
- You want **hooks + MCP**, not another every-message prompt wrapper  
- You care about **direction mistakes, repair loops, fake-green tests, and partial deploys**—the failure modes sandboxes do not close  

Search-ish keywords agents and humans use: coding agent evidence, agent hooks, stop gate, repair loop, test wash, deploy verify, MCP judgment tools.

## Features

- **Four judgments** — `direction`, `loop`, `done`, and deploy (`pre` / `verify`)
- **Closed check registry** — agents pick ids; they cannot invent check names (`custom:` only for extensions)
- **CLI + MCP** — same API; tools `deploy_check_direction` / `_loop` / `_done` / `_pre` / `_verify`
- **Opt-in per repo** — hooks may be installed user-wide, but **no-op** unless the repo has `deploy-units.json`
- **Optional hard gates** — Stop / edit / done gates force the matching call when configured
- **Post-deploy observe** — `http_json`, `http_text`, `file_sha256`, `command`, `literal`
- **Fail open on hook errors** — missing Node / bad JSON / unknown payload → allow + reason
- **English default UX** — Chinese via `"lang": "zh"` or `DEPLOY_CHECK_LANG=zh`
- **Host matrix** — Cursor, Claude Code, Codex, Trae, Copilot, Qoder, DSH ([honest matrix](docs/adapters.md))

## Install

```bash
npm i -g @majiturbo/deploy-check
# or one-shot:
npx @majiturbo/deploy-check --help
```

> **Note:** run `npx` from *outside* a checkout of this repo. Inside the clone, `npx` resolves the local package and there is no `.bin` link — use `node bin/check-deploy.mjs …` instead.

Requirements: **Node ≥ 22**, `git` on `PATH`. macOS / Linux / Windows.

## Quick start

```bash
cd /tmp
npx @majiturbo/deploy-check init --cwd /tmp/sample-app

# nearer path identical to current path → blocked
npx @majiturbo/deploy-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal 'speed up the slow page' \
  --path 'rewrite the renderer' \
  --nearer 'rewrite the renderer' \
  --why 'keep going' \
  --evidence 'user said the page is slow'
```

Trimmed result (advisory mode still returns `allow: true`; open gates to enforce):

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

Pass by naming a **different** nearer path:

```bash
npx @majiturbo/deploy-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal 'speed up the slow page' \
  --path 'rewrite the renderer' \
  --nearer 'profile first, then change the hot path' \
  --why 'no profile data yet' \
  --evidence 'user said the page is slow'
```

### Loop and done

```bash
# same approach class + "fixed" → blocked
npx @majiturbo/deploy-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried 'tweak CSS' --next 'tweak CSS'

# leave the class → passes
npx @majiturbo/deploy-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried 'tweak CSS' --next 'drop the effect' --alternative 'drop the effect'

# no green test on the record → blocked
npx @majiturbo/deploy-check done --cwd /tmp/sample-app --no-run --exit-code 1

# recorded exit 0 → passes (also scans uncommitted test diffs for wash)
npx @majiturbo/deploy-check done --cwd /tmp/sample-app --no-run --exit-code 0
```

Full contract: [`docs/judgments.md`](docs/judgments.md).

## Use it in an app repo

```bash
npx @majiturbo/deploy-check init --cwd /path/to/your-app
npx @majiturbo/deploy-check doctor --cwd /path/to/your-app

# optional user-level hooks (Cursor, Claude Code, Codex, …)
npx -p @majiturbo/deploy-check deploy-check-install-hooks
```

`init` writes `deploy-units.json` + an `AGENTS.md` fragment. Edit units and observe blocks — see [`docs/verify.md`](docs/verify.md) and [`examples/deploy-units.example.json`](examples/deploy-units.example.json).

### Hard gates

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true }
```

Then re-run install-hooks. Stop / edit events require a recent passing `direction` / `loop` / `done` receipt in `.deploy-check/`. Consumer paste rules: [`docs/rules/deploy-check.md`](docs/rules/deploy-check.md).

Undo hooks: `npx -p @majiturbo/deploy-check deploy-check-install-hooks --uninstall` (or `node scripts/install-hooks.mjs --uninstall` from a clone).

### MCP

```bash
npx -p @majiturbo/deploy-check deploy-check-mcp
```

Wire stdio MCP in your host; pass `{ "cwd": "/path/to/your-app" }` on each tool call. Fragments: [`examples/mcp.cursor.fragment.json`](examples/mcp.cursor.fragment.json), [`examples/mcp.claude-desktop.fragment.json`](examples/mcp.claude-desktop.fragment.json). Details: [`docs/mcp.md`](docs/mcp.md).

### Deploy path

```bash
npx @majiturbo/deploy-check --cwd /path/to/your-app --shadow
npx @majiturbo/deploy-check verify --cwd /path/to/your-app
```

Default mode is **advisory**. Prefer worktrees + push + CI/GitOps for release; use this when agents still claim “live” without a receipt.

## Checks (closed registry)

Agents may only select these ids.

**Direction / loop / done** (CLI or MCP)

| Id | Role |
|---|---|
| `direction_review` | Before sinking work: force a record that names a nearer/substitute path |
| `loop_escape` | When thresholds trip, next step must leave the failed approach class |
| `done_evidence` | Recorded test exit code `0` before saying done |
| `tests_untampered` | Uncommitted test diff must not delete tests or add skip / assert-true washes |

**Deploy** (shell hooks + `pre` / `verify`)

| Id | Role |
|---|---|
| `dirty_tree` | Dirty worktree; **forbids stash/checkout clearing** |
| `deploy_from_commit` | Require an explicit git SHA |
| `unpushed` | SHA must be on a remote-tracking branch |
| `units_declared` / `units_match` | Declared units; post-deploy observe matches target |
| `hotpatch_drift` | Host drift must return to git |

Custom checks: `custom:` prefix only.

## What you get

| Piece | Role |
|---|---|
| `deploy-units.json` | Opt-in enrollment; units, `done` / `loop` / `judgments` |
| CLI `deploy-check` | `direction`, `loop`, `done`, `pre-deploy`, `verify`, `init`, `doctor` |
| `deploy-check-mcp` | Same five judgment tools over stdio MCP |
| `hooks/bridge.mjs` + `hooks/run.sh` | Deploy shell bridge; optional Stop / edit gates |
| [`docs/adapters.md`](docs/adapters.md) | Hook matrix per host |

## Non-goals

- Semantic premise interception on every message  
- Replacing vendor shell sandboxes / Auto-review  
- Invented token-savings or anti-loop marketing numbers  
- Claiming a host without a documented hook + smoke payload  

## Documentation

| Doc | Contents |
|---|---|
| [`docs/judgments.md`](docs/judgments.md) | When to call direction / loop / done; evidence fields |
| [`docs/rules/deploy-check.md`](docs/rules/deploy-check.md) | Consumer `AGENTS.md` contract |
| [`docs/verify.md`](docs/verify.md) | Observe types and `verify` |
| [`docs/mcp.md`](docs/mcp.md) | MCP server setup |
| [`docs/hook-setup.md`](docs/hook-setup.md) | Install / uninstall hooks |
| [`docs/adapters.md`](docs/adapters.md) | Host support matrix |
| [`docs/cases/`](docs/cases/) | Pattern cases that motivated each check |
| [`examples/`](examples/) | Config fragments (hooks, MCP, units) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Dev commands and publish checklist |
| [`CHANGELOG.md`](CHANGELOG.md) | Release notes |
| [`SECURITY.md`](SECURITY.md) | Reporting |

## Status

**v0.1, experimental.** English UX by default; `"lang": "zh"` or `DEPLOY_CHECK_LANG=zh`. Trial with `DEPLOY_CHECK_MODE=shadow`. Some host UIs need a one-time toggle — see [`docs/hook-setup.md`](docs/hook-setup.md).

Package: [`@majiturbo/deploy-check`](https://www.npmjs.com/package/@majiturbo/deploy-check)  
Source: [`Majiturbo/deploy-check`](https://github.com/Majiturbo/deploy-check)

## License

MIT
