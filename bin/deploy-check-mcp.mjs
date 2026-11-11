#!/usr/bin/env node
/**
 * MCP stdio server for deploy-check.
 *
 * Claude Desktop / Cursor / any MCP host:
 *   { "command": "node", "args": ["/absolute/path/to/deploy-check/bin/deploy-check-mcp.mjs"] }
 *
 * Or after publish: npx deploy-check-mcp
 *
 * Tools: deploy_check_pre, deploy_check_verify — see docs/mcp.md
 */

import { startStdioServer } from '../src/mcp/stdio.mjs';

startStdioServer();
