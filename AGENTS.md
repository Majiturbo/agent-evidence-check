# AGENTS.md — rules for work *in this repository*

This file is the always-on contract for any coding agent editing **deploy-check** (this repo).  
If a habit conflicts with this file, **this file wins**.

Consumer apps (whatever the author uses day to day) are **not** part of this product. Do not treat them as the default target, do not wire their hosts into examples, and do not “finish the library” by only making those apps work.

---

## 1. What this repo is

| Is | Is not |
|---|---|
| An **open-source library** any developer can clone / `npm install` | A private toolkit for one person’s machines |
| Deploy, direction, loop, and done **evidence** checks + thin deploy hooks | Premise middleware on every message, or a CI/GitOps replacement |
| Portable paths, English-default UX, redacted case studies | Hard-coded `/Users/…`, one company’s URLs, or one app’s unit list |

v0.1 scope: deploy hooks + `verify`, plus explicit `direction`, `loop`, and `done` commands. Optional `judgments.stopGate` / `editGate` / `doneGate` force those calls via Stop/edit hooks — still not semantic chat scraping, and not on every message.

---

## 2. Hard constraints (do not violate)

1. **Audience = any GitHub user.** Every example, default, README snippet, and installer path must work for a stranger’s clone. Ask: “Would this still make sense if the author’s laptop and apps did not exist?”
2. **No personal absolute paths** in committed files (`/Users/…`, vendor runtime paths like a specific DSH Node). Use `hooks/run.sh`, `npx @majiturbo/deploy-check`, or documented placeholders such as `/ABS/PATH/TO/deploy-check/hooks/run.sh`.
3. **No private product identity in the public surface.** Examples use `example.com` and generic unit ids (`api`, `web_static`). Case studies stay **pattern + redacted**; do not put real hostnames, app brand names, or internal paths into `examples/`, `README*`, or user-facing strings.
4. **Opt-in per repo.** Hooks may be installed user-wide but must **no-op** unless that repo has `deploy-units.json`. Never make “install hooks” mean “police every repo on the machine.”
5. **One check implementation.** New agent hosts get a stdin dialect in `hooks/bridge.mjs` (and a row in `docs/adapters.md`) — do not fork `dirty_tree` per IDE.
6. **Honest matrix.** Do not claim support for a host without reading its public hook docs and sending a smoke stdin payload. Mark unverified what you have not verified.
7. **Fail open on hook errors** (missing Node, bad JSON, unknown payload): allow + reason. Do not brick every shell.
8. **Secrets.** Never commit API keys, `.env`, raw session dumps, or private transcripts.
9. **Tests before “done”.** `npm test` (or `node --test test/**/*.test.mjs`) must pass before claiming a check, dialect, installer, or verify observer works.
10. **Default language for product UX is English** (`src/i18n.mjs`). Chinese via `"lang": "zh"` or `DEPLOY_CHECK_LANG=zh`. Do not make Chinese the only message path.

---

## 3. What belongs where

| File | Audience | Put here | Do not put here |
|---|---|---|---|
| **`AGENTS.md` (this file)** | Agents editing *this* repo | Hard constraints, scope, pointers | Long tutorials, vendor paste dumps |
| **`docs/rules/deploy-check.md`** | Agents in *any consumer* app | Deploy, direction, and loop contract to link from their `AGENTS.md` | Installer internals, bridge dialects |
| **`docs/judgments.md`** | Any consumer | When to call direction and loop, and what evidence they require | Chat scraping, a hidden model |
| **`docs/verify.md`** | Any consumer | How to write `observe` / run `verify` | Personal host URLs |
| **`docs/adapters.md` / `docs/hook-setup.md`** | Integrators | Host matrix, install, Windows notes | Product roadmap essays |
| **`CONTRIBUTING.md`** | Human PR authors | Dev commands, publish checklist | Runtime hook policy (keep that in docs/rules) |
| **`examples/`** | Copy-paste starters | Portable fragments only | Author laptop paths or private apps |
| **Consumer app repos** | That app’s agents | Their `deploy-units.json` + link to `docs/rules` | Changes that belong in this library |

When the user says “continue” on this product, **default work is inside this repository**, for all users. Editing a sibling app is optional consumer setup, not a substitute for library completeness.

---

## 4. How to change code (checklist)

**Checks (`src/checks/`)**  
- Closed registry: new builtins get tests (pass + fail). Custom ids must use `custom:`.  
- User-facing strings go through `src/i18n.mjs` (en + zh keys in lockstep).

**Observe / verify / MCP (`src/observe/`, `src/api.mjs`, `src/mcp/`, bins)**  
- New `observe.type` values need tests and a line in `docs/verify.md`.  
- CLI and MCP must call `src/api.mjs` — do not fork check logic.  
- Do not bake a specific production URL into the library.

**Hooks (`hooks/`, `scripts/install-hooks.mjs`)**  
- Entry for Unix: `hooks/run.sh`. Windows install command: `node "<fwd-slash>/hooks/bridge.mjs"`.  
- Installer must be idempotent, rewrite old entries to the current package path, keep foreign hooks, support `--uninstall`.  
- Follow [`docs/rules/deploy-check.md`](docs/rules/deploy-check.md) for behavior; follow [`docs/adapters.md`](docs/adapters.md) for host claims.

**Docs**  
- Portable examples only. After adapter changes: vendor docs + smoke payload, then update the matrix.

**Commands**

```bash
npm test
node bin/check-deploy.mjs init --cwd /tmp/sample-app   # consumer scaffold (portable)
node bin/check-deploy.mjs doctor --cwd /tmp/sample-app
node bin/check-deploy.mjs --cwd . --shadow
node bin/check-deploy.mjs verify --cwd . --help
node bin/check-deploy.mjs direction --help
node bin/check-deploy.mjs loop --help
node bin/check-deploy.mjs done --cwd . --help
node bin/deploy-check-mcp.mjs
node scripts/install-hooks.mjs          # optional; writes into *this* user's $HOME
node scripts/install-hooks.mjs --uninstall
```

Node >= 22.

---

## 5. Anti-patterns (seen already — do not repeat)

- Teaching the installer or examples a path under `/Users/<author>/…`
- Adding `observe.url` aimed at the author’s production host into `examples/`
- “Finishing” open-source work by only patching the author’s other git repos
- Claiming Windows / Trae / Copilot / DSH support from docs skimming alone
- Shipping Chinese-only reasons in hooks so non-Chinese users get opaque denials
- Running direction or loop from the shell hook, or on every message

---

## 6. Quick pointers

- Consumer deploy contract: [`docs/rules/deploy-check.md`](docs/rules/deploy-check.md) (zh: [`docs/rules/deploy-check.zh-CN.md`](docs/rules/deploy-check.zh-CN.md))
- Verify / observe: [`docs/verify.md`](docs/verify.md)
- Direction and loop: [`docs/judgments.md`](docs/judgments.md)
- MCP server: [`docs/mcp.md`](docs/mcp.md)
- Host matrix: [`docs/adapters.md`](docs/adapters.md)
- Install: [`docs/hook-setup.md`](docs/hook-setup.md)
- Consumer paste fragment: [`examples/AGENTS.fragment.md`](examples/AGENTS.fragment.md)
- Human contributors: [`CONTRIBUTING.md`](CONTRIBUTING.md)
