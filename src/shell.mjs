/**
 * Run a consumer-authored shell string (done.testCommand, observe.command).
 * Unix: /bin/bash -lc. Windows: cmd.exe /d /s /c with the command wrapped and
 * internal quotes doubled so forms like `node -e "process.exit(0)"` survive CreateProcess.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @param {string} command
 * @param {{ cwd?: string, timeout?: number, maxBuffer?: number, env?: NodeJS.ProcessEnv }} opts
 */
export function runShellCommand(command, opts = {}) {
  const cwd = opts.cwd;
  const timeout = opts.timeout;
  const maxBuffer = opts.maxBuffer ?? 4e6;
  const env = opts.env || process.env;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    // Wrap and double quotes so cmd keeps an inner -e "…" string intact.
    const wrapped = `"${String(command).replace(/"/g, '""')}"`;
    return execFileAsync(comspec, ['/d', '/s', '/c', wrapped], {
      cwd,
      timeout,
      maxBuffer,
      windowsHide: true,
      env,
    });
  }
  return execFileAsync('/bin/bash', ['-lc', command], {
    cwd,
    timeout,
    maxBuffer,
    env,
  });
}
