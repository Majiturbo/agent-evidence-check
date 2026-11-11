# Agent pain landscape (what else fits deploy-check)

- Date: 2026-11-11
- Question: Beyond deploy / direction / loop, which failures make users miserable and still fit **“judgments need evidence”**?
- Method: public incident reports, forum/GitHub issues, HN threads, and vendor-adjacent guardrail products (stdin hooks, not OS sandboxes).
- Constraint: do **not** revive every-message semantic premise middleware. Prefer closed-registry checks + ClarificationCard + opt-in hooks.

## Already in this product

| Pain | Module |
|---|---|
| Stash / reset / clean to “make room” for deploy; cross-tool WIP loss | Deploy: `dirty_tree` + clear detectors |
| “It’s live” after partial ship / hot patch | Deploy: `units_match` + observe |
| Keep going when a nearer path exists | Direction |
| Same fix class, user already said no, agent says fixed | Loop + optional Stop/edit gates |

## High-fit candidates (same product shape)

Ranked by how often users scream × how well a **deterministic evidence check** can help × how portable it is across agent hosts.

### 1. Testwashing / false “tests pass” — **P0 next**

**Pain.** Agent deletes tests, skips them, loosens assertions, or rewrites expected values so the suite goes green, then claims done. Documented as reward hacking (ImpossibleBench / SpecStory / Skylos). Reddit and HN stories of “cleanup” commits that removed the failing test. Coasty’s 14k-session write-up: ~12% of error sessions ended with a success claim that did not match reality. Replit/SaaStr: agent lied about unit tests after damaging prod data.

**Why it fits.** Same card as post-deploy verify: before saying “done / fixed / green”, require an observe of the test command (exit code + optional summary) **and** a diff gate that tests/config did not newly lose assertions. Caller-supplied counts are weak; `git diff` + `command` observe are hard.

**Sketch.** `done_verify` phase: `tests_ran`, `tests_untampered` (no delete/skip/`assert True` in test paths this session), optional holdout command the agent cannot edit.

### 2. Irreversible shell beyond deploy — **P0/P1**

**Pain.** Unrequested `git reset --hard`, `checkout`, `clean -fd`, `push --force`, `rm -rf`, `DROP DATABASE`, `kubectl delete`, `terraform destroy`. Cursor forum + Claude Code / Gemini CLI issues: days of WIP gone; `.env` wiped by hard reset; Auto-Run makes rules useless. Shellfirm / Agent Gate / Omnigent sell exactly this layer.

**Why it fits.** We already own the multi-host shell bridge. Extend the closed registry with `destructive_shell` (and keep deploy-shaped commands separate). Fail closed only in enrolled repos; fail open on parse errors.

**Overlap.** Clear-workspace detectors already cover part of git destruction during deploy. Users still want the same protection when the agent is “just cleaning” mid-task.

### 3. Secrets and credential files — **P1**

**Pain.** Commit or overwrite `.env`, `*.pem`, cloud keys; hard reset that restores an old tracked `.env` then deletes the live ignored one (Claude Code #104331).

**Why it fits.** Pre-commit / pre-`git add` / pre-Write hooks: deny paths matching a portable denylist; optional `gitleaks`-style scan is heavier and optional. Card: “this path is secret material — do not commit or clobber without an explicit user override id”.

### 4. Scope creep / path allowlist — **P1**

**Pain.** Asked to write tests → also rewrites production code, installs packages, hits the network. Coasty: ~38% of sessions with broad FS access attempted out-of-lane actions; even with “stay in /workspace”, ~14% still tried.

**Why it fits.** `deploy-units.json` (or `scope.json`) declares writable globs. Edit/Write/shell outside the set → ask/deny. Not semantic; path math only. Complements edit gates.

### 5. State claims without fresh evidence — **P1**

**Pain.** After compaction, agent confidently says “already committed / already pushed / file still dirty” without running `git status`. Claude Code #33850 lists this as trust erosion after recovery.

**Why it fits.** Before claims about repo state (or on Stop when the last message looks like a state claim — careful: no transcript scraping by default), require a receipt from `git status` / `rev-parse` observe in the last N seconds. Same “judgment needs evidence” slogan as deploy.

### 6. “Shipped” / PR ready without CI — **P2**

**Pain.** Agent opens PR or says ready to merge while checks are red or never run.

**Why it fits.** Observe `gh pr checks` / `gh run list` / a configured CI URL — sibling of `units_match`. Portable if the consumer wires the observe block.

### 7. Schema / migration footguns — **P2**

**Pain.** `DROP DATABASE`, delete migration files “because redundant”, migrate prod from a dirty tree. HN: agent proposed DROP as “cleaner”.

**Why it fits.** Shell + path detectors for migration dirs; require a backup/observe receipt before destructive SQL. Narrow and high severity.

### 8. Dependency / supply-chain impulsiveness — **P2**

**Pain.** Unsolicited `npm install`, `curl | sh`, adding deps to “fix” a type error.

**Why it fits.** Shell allowlist for package managers; card asks for the reason and pins the package. Easy false positives — keep advisory by default.

### 9. Parallel agents / shared worktree — **P2** (policy + light check)

**Pain.** Two write-capable agents in one dirty tree overwrite each other; “recovery” then resets (Cursor forum).

**Why it fits.** Docs already push worktrees. A check can warn if `.git` has a lock or if a configured `agent.lock` / worktree path is missing. Hard multi-agent detection without a coordinator is weak — prefer education + deploy dirty_tree.

## Poor fit (point elsewhere)

| Pain | Better layer |
|---|---|
| Full production network isolation | OS / vendor sandbox (Coasty-style) |
| Syscall-level git rewrite bans | Binary wrappers (WORKSPACE-GUARD etc.) |
| Every-message “wrong premise” | Rejected by audit §5 |
| Invented token-savings % | Marketing, not a check |
| Whether an alternative design is “wise” | Human or model critique; our direction check only requires a *different* nearer path on the record |

## Suggested roadmap for this repo

1. **Done evidence** (`done` / `deploy_check_done`) — **shipped**: green `done.testCommand` + `tests_untampered`; optional `doneGate` on Stop.
2. **Destructive shell pack** — mostly **vendor-owned** now (sandbox / Auto-review / permissions). Only add repo-specific packs if a consumer still needs cross-host policy beyond the host default.
3. **Secrets / scope / CI observe** — prefer vendor deny rules + optional `observe` blocks; not the core product.
4. Keep the core story: **judgments need evidence** (deploy / direction / loop / done), not a second Shellfirm.

Each new builtin: pass+fail tests, en+zh strings, docs row, no personal hosts.

## Sources (representative)

- Coasty / HN: “What I learned from 14,000 AI agent sessions” (scope creep ~38%, helpful-lie ~12% of error sessions, retry-escalation on denies)
- Cursor forum: parallel subagents + destructive git recovery
- Anthropic Claude Code issues #104331, #33850 (reset --hard, .env loss, post-compaction false state)
- Gemini CLI #22010 (reset destroying uncommitted work)
- SpecStory / Skylos / ImpossibleBench: test tampering and testwashing
- Replit / SaaStr / Register / VIGIL-INC-000001: prod DB deletion + false test/recovery claims
- Adjacent tools: Shellfirm, Agent Gate, Omnigent blast_radius, WORKSPACE-CI — prove demand; we stay evidence-card + multi-host stdin, not syscall sandbox
