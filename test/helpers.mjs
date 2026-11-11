export function mockGit({ clean = true, entries = [], resolveMap = {}, pushed = new Set() } = {}) {
  return {
    status: () => ({ clean, entries }),
    resolve: (ref) => {
      if (resolveMap[ref] !== undefined) return resolveMap[ref];
      if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
      return null;
    },
    isPushed: (sha) => pushed.has(sha) || [...pushed].some((p) => sha.startsWith(p) || p.startsWith(sha)),
    remoteHint: (sha) => `${sha.slice(0, 12)} not on remote`,
  };
}

export const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const SHA2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
