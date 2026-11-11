/**
 * Run a consumer-authored shell string (done.testCommand, observe.command).
 * Uses child_process.exec so Windows cmd.exe and Unix shells parse nested
 * quotes the same way users type them in a terminal (e.g. node -e "…").
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * @param {string} command
 * @param {{ cwd?: string, timeout?: number, maxBuffer?: number, env?: NodeJS.ProcessEnv }} opts
 */
export function runShellCommand(command, opts = {}) {
  /** @type {import('node:child_process').ExecOptions} */
  const execOpts = {
    cwd: opts.cwd,
    timeout: opts.timeout,
    maxBuffer: opts.maxBuffer ?? 4e6,
    windowsHide: true,
    env: opts.env || process.env,
  };
  // Prefer bash on Unix so -lc-style scripts and common builtins match docs.
  if (process.platform !== 'win32') execOpts.shell = '/bin/bash';
  return execAsync(command, execOpts);
}
