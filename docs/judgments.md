# Direction review and loop escape

[中文规则见](./rules/deploy-check.zh-CN.md)

Deploy checks answer “is it live?” from git and from `observe` blocks. Direction, loop, and **done** need a written record or a green test receipt. This library does **not** read the chat and does **not** call a model. Shell hooks do **not** run these checks (Stop/edit gates only force the call when you opt in).

Default mode is advisory: the process exits 0 and returns a card. `--block` exits 2 when the record is incomplete. Neither mode runs on ordinary shell commands.

## Direction — project start, or a turn

Call this before writing code on a new task, and again when the user changes the goal, rejects the approach, or you notice a shorter path.

A pass needs all of:

| Field | Meaning |
|---|---|
| `moment` | `start` or `turn` |
| `goal` | What the user asked for |
| `path` | What you are about to continue |
| `nearer` | A **different** path that could finish sooner |
| `whyNotNearer` | Why you are taking that nearer path, or the fact that makes you leave it |
| `evidence` | One fact: a file, a constraint, or the user’s sentence |

```bash
npx agent-evidence-check direction --cwd . --moment turn \
  --goal "Ship a static banner" \
  --path "Keep tuning the canvas animation" \
  --nearer "Use one static image" \
  --why "The animation is still wrong after three reviews" \
  --evidence "User said the motion is still wrong in the last screenshot"
```

MCP tool: `deploy_check_direction`.

## Loop — same approach class, already failing

Call this before saying “fixed” or “done” on something you have already reworked.

It trips when any of these is true (defaults; override with `loop.minEdits` / `loop.minRejections` in `deploy-units.json`):

- edits of this target ≥ 3 **and** the user has rejected it at least once
- user rejections ≥ 2
- you are about to claim fixed **and** the user has rejected it at least once
- you are about to claim fixed **and** edits ≥ 3

A pass after a trip needs `next` to be a **different** class from `tried`, and `next` must be one of `--alternative`.

```bash
npx agent-evidence-check loop --cwd . --target banner --edits 4 --rejections 2 \
  --tried "tweak animation" --next "use a static image" \
  --alternative "use a static image" --alternative "drop the effect"
```

MCP tool: `deploy_check_loop`.

An attempt that has not tripped (one edit, no rejection, not claiming fixed) passes without a card.

## Done — before saying fixed / green / done

Vendors sandbox shells; they do not prove the suite was not washed. Call this before claiming success.

A pass needs:

1. `done.testCommand` (default `npm test`) exited **0** (the CLI runs it, or you pass `--exit-code 0 --no-run`)
2. Uncommitted diff under `done.testPaths` must not **delete** test files or add classic wash lines (`it.skip`, `test.skip`, `assert True`, `expect(true)`, …)

```bash
npx agent-evidence-check done --cwd .
npx agent-evidence-check done --cwd . --command "npm test" --block
# already ran tests:
npx agent-evidence-check done --cwd . --exit-code 0 --no-run --command "npm test"
```

MCP tool: `deploy_check_done`. Config:

```json
"done": { "testCommand": "npm test", "testPaths": ["test", "tests", "spec"] },
"judgments": { "doneGate": true }
```

With `doneGate` (and `stopGate`) on, Stop blocks after edits until a successful done receipt exists **after** those edits.

## What this does not do

- It does not watch the transcript. You pass the counts and the sentences.
- It does not decide that your alternative is wise. It rejects a missing record, and a next step that stays in the class you already tried.
- It does not run on every message, and it does not share the deploy shell hook.

## How to make the agent actually call them

Nothing in this library can read “I am done” out of free text on every host. Deploy hooks see shell; direction and loop only run when something **invokes** them. Use the strongest layer your host allows.

### 1. Contract (every host — required baseline)

1. Keep [`docs/rules/deploy-check.md`](./rules/deploy-check.md) linked from the app’s `AGENTS.md` (rules 7–9).
2. Configure the MCP server so `deploy_check_direction`, `deploy_check_loop`, and `deploy_check_done` are always listed (see [`docs/mcp.md`](./mcp.md)).
3. Prefer MCP over shell for these three: the tool schema already names the required fields.

This is soft. The model can ignore rules. Without the next layers, ignore is common under time pressure.

### 2. Prefer MCP, and say when

In the app `AGENTS.md` (or your host’s always-on rules), keep the calls unconditional at the moments that matter:

- **Before the first edit** on a new task → `deploy_check_direction` with `moment: "start"`.
- **When the user changes the goal, rejects the approach, or a shorter path appears** → `deploy_check_direction` with `moment: "turn"`.
- **Before saying fixed / done / live after rework** → `deploy_check_loop`. If `ok` is false, do not claim fixed; switch class or ask.
- **Before saying done / tests pass / fixed after edits** → `deploy_check_done`. If `ok` is false, restore tests or fix the code; do not claim green.

Treat a missing or failed call like a failed test: do not continue that path.

### 3. Hard gates (opt-in per repo)

In `deploy-units.json`:

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true },
"loop": { "minEdits": 3, "minRejections": 2 },
"done": { "testCommand": "npm test", "testPaths": ["test", "tests"] }
```

Then `npm run install-hooks` wires:

| Host | Event | Behavior when gates are on |
|---|---|---|
| Claude Code | `Stop` | `decision: "block"` + reason to call direction, loop, or done |
| Claude Code | `PreToolUse` on Edit/Write/… | Deny after `minEdits` on the same file until a successful loop receipt |
| Cursor | `stop` | `followup_message` asking for the MCP/CLI call (`loop_limit: 3`) |
| Cursor | `preToolUse` on Write/StrReplace/… | Same edit gate |

How receipts work:

1. A **passing** `direction` / `loop` / `done` (CLI or MCP) writes `.deploy-check/session.json` (gitignored).
2. Each Edit/Write increments a per-file counter and a session `editTotal`.
3. Stop blocks if there were edits and no direction receipt; if edit count ≥ `minEdits` and no loop receipt **after** those edits; if `doneGate` and no done receipt **after** those edits.
4. A passing `loop` clears **per-file** counters (editGate unlocks) but keeps `editTotal` / `lastEditAt` so `doneGate` still applies to the same burst.
5. `doneGate` alone is enough to force done on Stop; `stopGate` alone still forces direction/loop without requiring done.

### Known limits (honest)

- `--exit-code 0 --no-run` trusts the caller’s exit code (MCP when tests already ran). Prefer letting `done` run `done.testCommand`.
- `tests_untampered` only scans the **uncommitted** diff under `done.testPaths`. A wash that is already committed will not trip it.
- Gates do not scrape chat text saying “done”; they only force the tool call when Stop/edit hooks fire.

`stop_hook_active` (Claude) and `loop_count` ≥ 3 (Cursor) fail open so the agent is not stuck forever. Shadow mode never gates. Repos without `deploy-units.json` are untouched. Gates default **off** unless you set `judgments.stopGate` / `editGate` / `doneGate` (or `"gates": true`).

Verified with stdin smoke payloads in `test/gates.test.mjs`. Live Claude/Cursor sessions: still confirm once on your machine after install.

Do **not** scrape the full transcript to guess whether a loop is happening. Counts for the check itself stay caller-supplied; the gate only forces the call.

### 4. Practical default for a consumer app

1. `deploy-check init`, then set `"judgments": { "stopGate": true, "editGate": true, "doneGate": true }` (example ships this on).
2. Wire MCP (`deploy_check_*` tools).
3. Keep rules 7–9 in `AGENTS.md`.
4. `npm run install-hooks` from your deploy-check clone.
