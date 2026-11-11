# Security

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes (experimental) |

## What this tool does and does not do

- Hooks and MCP run **on the developer machine**, with the same privileges as the agent host.
- `observe.type = command` and `done.testCommand` execute **whatever string the consumer repo authored** in `deploy-units.json` (or CLI/MCP overrides). Treat that file like code review for shell access.
- `deploy-check done --exit-code … --no-run` trusts the caller’s exit code; prefer letting `done` run the configured command.
- The hook layer **fails open** on internal errors (missing Node, malformed config) so a broken install does not freeze every shell. Copilot `preToolUse` may still deny if the process crashes before responding — keep `node` on `PATH`.

## Reporting

Please open a GitHub issue at https://github.com/Majiturbo/agent-evidence-check/issues describing the issue without secrets. Do not attach production credentials, session dumps, or `.env` files.
