# Installing hooks (any developer)

## Recommended

From a clone or npm package of **this** repo:

```bash
npm test
npm run install-hooks
npx @majiturbo/deploy-check doctor --cwd /path/to/your-app   # Node, enrollment, hook presence
```

That runs `scripts/install-hooks.mjs`, which points every supported agent config at **this package**:

- macOS / Linux: `hooks/run.sh`. It finds Node via `DEPLOY_CHECK_NODE`, `PATH`, then Homebrew / nvm / fnm locations, because GUI-launched apps often lack a full `PATH`.
- Windows: `node "C:/…/deploy-check/hooks/bridge.mjs"` (forward slashes). This one string runs unchanged in PowerShell (Cursor, Trae), Git Bash or PowerShell (Claude Code) and cmd. Codex also gets `commandWindows`.

Report JSON tells you what was added. Backups are written next to each config as `*.bak.<timestamp>`.

## Manual

If you prefer not to touch `$HOME` automatically, copy a fragment from `examples/` and set:

```text
macOS / Linux: /absolute/path/to/deploy-check/hooks/run.sh
Windows:       node "C:/absolute/path/to/deploy-check/hooks/bridge.mjs"
```

On Windows, do not start the command with a quoted path (`"C:/Program Files/…/node.exe" …`): PowerShell treats a leading quoted string as a value and prints it instead of running it.

| Agent | Example fragment | Matcher / event |
|---|---|---|
| Cursor | (install-hooks writes `beforeShellExecution`) | shell command string |
| Claude Code | `examples/claude-settings.fragment.json` | `Bash` |
| Codex | `examples/codex-hooks.fragment.json` | `Bash` |
| Trae | `examples/trae-hooks.json` | **`RunCommand`** |
| Qoder | `examples/qoder-settings.fragment.json` | `Bash` |
| VS Code Copilot | `examples/copilot-hooks/deploy-check.json` | `preToolUse` / `bash` |
| DSH | `examples/dsh-hooks.json` | needs hooks bridge **or** import Claude Code hooks |

## App repos

1. Add `deploy-units.json` (start from `examples/deploy-units.example.json`).
2. Link [`docs/rules/deploy-check.md`](./rules/deploy-check.md) from `AGENTS.md`.
3. Optional: commit a **workspace** Copilot hook under `.github/hooks/` that calls the same `hooks/run.sh` (path must be valid on each teammate’s machine—prefer `npx`/`PATH` after publish, or document “clone deploy-check next to the app”).

## Scope: per-repo opt-in

Hooks are installed user-wide but **only act in repos that contain `deploy-units.json`** (looked up from the shell's cwd up to the git root). Every other repo gets an immediate `allow`. Undo everything with:

```bash
node scripts/install-hooks.mjs --uninstall   # removes only deploy-check entries
```

In an enrolled repo you can replace the built-in deploy-command patterns:

```json
{ "units": [...], "deployCommands": ["^\\./scripts/deploy\\.sh", "\\bkubectl\\s+apply\\b"] }
```

## Modes

```bash
export DEPLOY_CHECK_MODE=advisory   # default
export DEPLOY_CHECK_MODE=shadow     # never deny; log findings
export DEPLOY_CHECK_MODE=block      # hard deny where the host supports it
```

What “advisory” means per host:

| Situation (enrolled repo) | Cursor | Claude Code / Codex / Trae / Qoder / Copilot / DSH |
|---|---|---|
| stash / checkout -- / reset --hard / clean -f on a **dirty** tree | ask | deny with reason |
| same on a **clean** tree | allow + note | allow |
| deploy command with block-level findings | ask | deny with reason |

PreToolUse hosts get `deny` rather than `ask` because `ask` is not documented for all of them; the agent receives the reason and is expected to fix the tree or ask the user. Use `shadow` for a trial period.

## Language

English by default. Chinese: `"lang": "zh"` in `deploy-units.json` (recommended, because GUI apps rarely pass `LANG` to hooks) or `DEPLOY_CHECK_LANG=zh`.

## Known limits

- **Windows**: `node` must be on `PATH` for GUI apps (the official Node.js installer does this). If it is not, the hook cannot start. Copilot then **denies** the tool call (it treats a crashed `preToolUse` as deny), and Claude Code without Git Bash may block. CI runs the tests on Windows; live sessions in each Windows host have not been verified yet.
- **Codex / Qoder on Windows**: their docs do not name the default Windows shell; the `node "…"` form is expected to work but is unconfirmed.
- **Heuristic matching**: commands are matched by pattern, so wrappers like `make release` are missed unless listed in `deployCommands`.
- **Shell tools only**: an agent that edits files or calls an MCP deploy tool bypasses hooks; the rules file in `AGENTS.md` covers that.
- **Post-deploy is opt-in per unit**: `deploy-check verify` only auto-reads units with an `observe` (or object `verify`) block. String-only units stay `manual` until you pass `--observed` or add a spec.
- **Fail open**: if the config is malformed or the hook errors, it allows and says so in the reason. On macOS/Linux, `run.sh` also fails open when Node is missing.

## Smoke

```bash
echo '{"command":"git stash push -u -m wip before deploy","cwd":"'"$PWD"'"}' \
  | ./hooks/run.sh
```

Expect `permission` / `permissionDecision` reflecting a dirty-tree or clear-workspace finding when the cwd is a dirty git repo.
