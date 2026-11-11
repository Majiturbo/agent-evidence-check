# Post-deploy verify (any repo)

`deploy-check verify` observes each unit and runs `units_match`. It does not SSH or call your hosts unless **you** put that in the unit’s `observe` block.

## 1. Declare units

Copy [`examples/deploy-units.example.json`](../examples/deploy-units.example.json) into your app repo as `deploy-units.json`. Rename ids to match **your** surfaces (API, static site, worker, mobile artifact, …).

Hooks only run checks in repos that contain this file.

## 2. Make observation machine-readable

| `observe.type` | Use when |
|---|---|
| `http_json` | Health/version endpoint returns JSON (`field` or dotted `path`) |
| `http_text` | Plain body or regex capture (`pattern`) |
| `file_sha256` | Artifact is a local or mounted file |
| `command` | You need `ssh`, `kubectl`, `aws`, etc. — the string is authored by this repo |
| `literal` | Fixtures / tests only |

String-only `verify` is documentation. Those units stay `manual` until you pass `--observed` or add `observe`.

Optional `"lang": "zh"` for Chinese messages; default is English.

## 3. Run

```bash
# after a deploy, before saying "it's live"
npx @majiturbo/deploy-check verify --cwd /path/to/your-app

# one unit
npx @majiturbo/deploy-check verify --cwd . --unit api

# fill manual units
npx @majiturbo/deploy-check verify --cwd . --observed '{"web_static":"<sha256>"}'

# CI: fail the job when mismatched
npx @majiturbo/deploy-check verify --cwd . --block
```

Exit code is non-zero only with `--block` (so agents can always parse the JSON). Advisory mode prints `"ok": false` without failing the process.

## 4. Claim language

- All units observed and matched → you may say the release is live (for those units).
- Any mismatch or missing observation → say which units updated; do not say “everything is live”.
