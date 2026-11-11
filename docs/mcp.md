# MCP server (any MCP host)

`deploy-check` exposes the same checks as the CLI over the [Model Context Protocol](https://modelcontextprotocol.io/) stdio transport (one JSON-RPC message per line). Use this when you want agents to **call** evidence checks explicitly, without relying on each IDE’s shell hooks.

Hooks and MCP complement each other: hooks catch impulsive `ssh`/`stash`; MCP lets the agent run `verify` before saying “live”.

## Tools

| Tool | When |
|---|---|
| `deploy_check_pre` | Before a deploy-shaped command |
| `deploy_check_verify` | After deploy, before claiming “it’s live” |
| `deploy_check_direction` | Project start, or a turn, before continuing the old path |
| `deploy_check_loop` | Before saying a repeated fix is done |
| `deploy_check_done` | Before saying done / tests pass; rejects washed tests |

Each tool returns JSON text (and `structuredContent`) with `ok`, `findings`, and `elicitations` (MCP elicitation-shaped cards).

## Run

From a clone:

```bash
node /absolute/path/to/deploy-check/bin/deploy-check-mcp.mjs
```

After publish:

```bash
npx deploy-check-mcp
```

## Host config examples

Copy [`examples/mcp.cursor.fragment.json`](../examples/mcp.cursor.fragment.json) or [`examples/mcp.claude-desktop.fragment.json`](../examples/mcp.claude-desktop.fragment.json) and replace `/ABS/PATH/TO/deploy-check` with **your** clone or package path. Do not copy another machine’s home directory.

Pass `cwd` in each tool call so the server checks the app repo, not the MCP server’s cwd:

```json
{ "cwd": "/path/to/your-app" }
```

## Consumer agent instructions

Link [`docs/rules/deploy-check.md`](./rules/deploy-check.md) from the app’s `AGENTS.md`, and tell the agent to call `deploy_check_direction` / `deploy_check_loop` / `deploy_check_done` / `deploy_check_verify` at the moments in that contract. A paste-ready fragment: [`examples/AGENTS.fragment.md`](../examples/AGENTS.fragment.md).
