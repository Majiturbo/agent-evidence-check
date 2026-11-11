#!/usr/bin/env node
/**
 * MCP stdio server for agent-evidence-check.
 *
 * Claude Desktop / Cursor / any MCP host:
 *   { "command": "node", "args": ["/absolute/path/to/agent-evidence-check/bin/agent-evidence-check-mcp.mjs"] }
 *
 * Or after publish: npx agent-evidence-check-mcp
 *
 * Tools: deploy_check_pre, deploy_check_verify — see docs/mcp.md
 */

import { startStdioServer } from '../src/mcp/stdio.mjs';

startStdioServer();
