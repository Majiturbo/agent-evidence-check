# 0004 Direction, loop, and done enter v0.1 — still off the shell hook

- Status: accepted
- Date: 2026-11-11
- Related: `docs/decisions/0002-product-redeploy.md`, `docs/judgments.md`

## Decision

0002 put direction review and loop escape on the roadmap. Before submit, those two had to run — and still must not intercept every message. After vendor sandboxes absorbed generic shell safety, the remaining product gap was **fake-green / claiming done**, so `done` joined the same family.

- Entrypoints: `deploy-check direction` / `loop` / `done`, and MCP tools `deploy_check_direction` / `deploy_check_loop` / `deploy_check_done`.
- Callers submit evidence (goal, path, nearer path, edit counts, approach class, or a green test exit). The library does not read the chat and does not call a model.
- Missing record, next step still in a failed approach class, non-zero test exit, or washed test diff → ClarificationCard. Default advisory exit 0; `--block` exits 2.
- The shell hook still only covers deploy commands. Unenrolled repos (no `deploy-units.json`) skip all of this.
- Optional `judgments.stopGate` / `editGate` / `doneGate` force the calls via Stop / edit hooks when `install-hooks` is current — still not transcript scraping.

## Why done is in scope

Vendors now deny many destructive shells. They do not prove “tests pass” means the suite was not deleted or skipped. That is the same evidence-judgment niche as deploy / direction / loop.
