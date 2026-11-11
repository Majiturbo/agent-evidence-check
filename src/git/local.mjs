/**
 * Real git adapter (Node child_process). Tests use a plain mock object instead.
 */

import { execFileSync } from 'node:child_process';

function run(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
}

export function createLocalGit(cwd = process.cwd()) {
  return {
    status() {
      const out = run(cwd, ['status', '--porcelain']);
      const entries = out ? out.split(/\r?\n/).filter(Boolean) : [];
      return { clean: entries.length === 0, entries };
    },
    resolve(ref) {
      try {
        return run(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).toLowerCase() || null;
      } catch {
        return null;
      }
    },
    isPushed(sha) {
      try {
        const full = run(cwd, ['rev-parse', '--verify', `${sha}^{commit}`]);
        return Boolean(run(cwd, ['branch', '-r', '--contains', full]));
      } catch {
        return false;
      }
    },
    /** Porcelain name-status lines vs base (default HEAD). Empty if clean / error. */
    diffNameStatus(base = 'HEAD', paths = []) {
      try {
        const args = ['diff', '--name-status', '--relative', base, '--'];
        if (paths?.length) args.push(...paths);
        else args.push('.');
        const out = run(cwd, args);
        return out ? out.split(/\r?\n/).filter(Boolean) : [];
      } catch {
        return [];
      }
    },
    /** Unified diff text vs base for the given paths. */
    diffText(base = 'HEAD', paths = []) {
      try {
        const args = ['diff', '--unified=0', '--relative', base, '--'];
        if (paths?.length) args.push(...paths);
        else args.push('.');
        return run(cwd, args);
      } catch {
        return '';
      }
    },
  };
}
