# Contributing

## Scope

v0.1 ships **deploy** verification (hooks + `verify`), plus explicit **direction**, **loop**, and **done** commands that share the ClarificationCard. Those three stay off the shell hook and must not run on every message.

## Rules of the road

1. **No machine-specific paths** in committed config examples (`/Users/…`, vendor runtime paths). Use `hooks/run.sh` or `npx deploy-check install-hooks`.
2. **One check implementation**: new tools get a stdin dialect in `hooks/bridge.mjs` or a docs row—do not copy `dirty_tree`.
3. **Honest adapter matrix**: if you have not run the vendor docs + a smoke payload, mark the tool as unverified; do not claim support.
4. **Tests**: every builtin check needs positive and negative cases in `test/`.
5. **Secrets**: never commit API keys, `.env`, or raw session dumps. Case studies must stay redacted.

## Dev

```bash
node --test test/**/*.test.mjs
node bin/check-deploy.mjs --cwd . --shadow
node bin/check-deploy.mjs verify --cwd .
node bin/check-deploy.mjs direction --help
node bin/check-deploy.mjs loop --help
node bin/check-deploy.mjs done --cwd . --command "node -e \"process.exit(0)\"" --no-run --exit-code 0
node bin/deploy-check-mcp.mjs    # MCP stdio; see docs/mcp.md
node scripts/install-hooks.mjs   # optional, writes into your $HOME agent configs
```

Follow root [`AGENTS.md`](AGENTS.md) (open-source audience, no personal paths). Node >= 22.

## Publishing (GitHub / npm)

1. Public URLs in `package.json` point at `Majiturbo/deploy-check`. Create that empty GitHub repo before the first push if it does not exist yet.
2. Do **not** commit private transcripts, `.env`, or machine-local hook configs (`.cursor/` is gitignored).
3. Prefer a **clean initial history** for the first public push. Older local commits may still contain author laptop paths and private app names; a squash or orphan commit avoids publishing those blobs.

```bash
# example only — run when you are ready to publish; does not push
git checkout --orphan public-v0.1
git add -A
git status   # confirm no private transcripts, no /Users paths in staged text
git commit -m "deploy-check 0.1.0"
# then: create empty GitHub repo, set remote, push -u origin public-v0.1:main
```

4. Confirm `npm pack --dry-run` has no `/Users/` paths and no session dumps.
5. Tag `v0.1.0` after CI is green; `npm publish` only after the GitHub URL is real.
6. First-time consumers should run `npm run install-hooks` from **their** clone so `$HOME` points at their path, not yours.
