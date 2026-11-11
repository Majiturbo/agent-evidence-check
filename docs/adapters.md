# Multi-agent adapter matrix (verified)

**Source of truth is the repo contract** (`deploy-units.json` + rules + CLI). Each agent only gets a thin stdin hook. Verified against public docs: 2026-11-11.

| Agent | Hard hook? | Config location | Shell tool / matcher | Docs | How to install |
|---|---|---|---|---|---|
| **Cursor** | ✅ `beforeShellExecution` | `~/.cursor/hooks.json` | top-level `command` | Cursor Hooks | `npm run install-hooks` |
| **Claude Code** | ✅ `PreToolUse` | `~/.claude/settings.json` or project `.claude/settings.json` | `Bash` | [Hooks reference](https://code.claude.com/docs/en/hooks) | `npm run install-hooks` |
| **Codex** | ✅ `PreToolUse` | `~/.codex/hooks.json` | `Bash` | [ChatGPT Learn · Hooks](https://learn.chatgpt.com/docs/hooks) | `npm run install-hooks` |
| **VS Code Copilot** | ✅ `preToolUse` (Preview) | `~/.copilot/hooks/*.json` or `.github/hooks/*.json` | runtime `bash` | [Copilot hooks](https://docs.github.com/en/copilot/concepts/customizations/hooks), [VS Code](https://code.visualstudio.com/docs/agent-customization/hooks) | `npm run install-hooks` + enable Agent hooks UI |
| **Trae** | ✅ `PreToolUse` | `~/.trae/hooks.json` (CN builds often use `~/.trae-cn/`) | **`RunCommand`** (not `Bash`) | [Trae hook reference](https://docs.trae.ai/ide/hook-configuration-reference) | `npm run install-hooks` + Settings → Hooks on; enable Include AGENTS.md |
| **Qoder** | ✅ `PreToolUse` | `~/.qoder/settings.json` | `Bash` | [Qoder hooks](https://docs.qoder.com/cli/hooks) | `npm run install-hooks` |
| **DSH** | ✅ via Cordis `tools/pre-execute` and/or Claude-Code hook bridge | `~/.dsh/hooks.json` and/or import `~/.claude/settings.json` | `Bash` / `bash` / `pwsh` | [Tool pipeline](https://deepseek-harness.github.io/deepseek-harness/en/reference/tool-execution-pipeline.md) | `npm run install-hooks` writes `~/.dsh/hooks.json`; **enable the hooks bridge or import Claude Code hooks** or the file alone does nothing |

## Windows (docs read 2026-11-11)

| Agent | Windows shell for `command` | Extra field we write |
|---|---|---|
| Cursor | PowerShell | — |
| Claude Code | Git Bash, else PowerShell | — |
| Codex | not documented | `commandWindows` |
| VS Code Copilot | `powershell` field, falls back to `command` | — |
| Trae | PowerShell | — |
| Qoder | "system default" | — |
| DSH | not documented | — |

The installer writes `node "<fwd-slash path>/hooks/bridge.mjs"` on Windows. Live Windows sessions are not yet verified for any host; CI covers the bridge and installer.

## Dialects (`hooks/bridge.mjs`)

| Flavor | Command field | Deny output |
|---|---|---|
| Cursor | `command` | `{ permission }` |
| Claude / Codex / Qoder / Trae | `tool_input.command` | `hookSpecificOutput.permissionDecision` |
| Copilot | `toolArgs.command` | flat `{ permissionDecision, permissionDecisionReason }` |

## Judgment gates (opt-in)

When `deploy-units.json` has `"judgments": { "stopGate": true, "editGate": true }`, the same `hooks/run.sh` / `bridge.mjs` also handles:

- Claude Code `Stop` + Edit/Write `PreToolUse`
- Cursor `stop` + `preToolUse` (Write/StrReplace/…)

See [`docs/judgments.md`](./judgments.md). Stdin smokes are in `test/gates.test.mjs`. Live sessions not yet matrix-claimed beyond that.

## Rules layer (still required)

Deploy hooks only see shell tool calls. Direction/loop still need MCP or CLI (gates only force the call). Keep [`docs/rules/agent-evidence-check.md`](./rules/agent-evidence-check.md) linked from every app’s `AGENTS.md`.
