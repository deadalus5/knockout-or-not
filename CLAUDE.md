# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KnockoutOrNot is a spoiler-free UFC fight guide: it tells you whether a fight is worth watching (finish vs. decision, excitement, pace) while making it **impossible to learn who won**. That guarantee is the whole product — see "The spoiler boundary" below before changing anything in the data pipeline or the published schema.

## Commands

Run from the repo root (npm workspaces: `shared`, `pipeline`, `web`).

```bash
npm ci                 # install
npm run dev            # web dev server (http://localhost:5173)
npm test               # all tests (pipeline vitest + web vitest)
npm run typecheck      # tsc --noEmit across all three workspaces
npm run audit          # spoiler audit of committed web/public/data
npm run build          # typecheck + vite build (PWA) + SPA 404 fallback
npm run smoke          # build must exist first; boots preview, asserts data + PWA + no spoilers
```

Single test / single file (vitest `-t` filters by name):
```bash
npm -w pipeline run test -- scoringAndSanitize        # one pipeline test file
npm -w web run test -- -t "reveal flow"               # one web test by name
```

Data pipeline:
```bash
npm run data:refresh   # CSV back-catalogue + Wikipedia events newer than the CSV cutoff
npm run data:backfill  # one-time full Wikipedia backfill (throttled ~15 min); writes pipeline/data/wikiExtract.json
npm -w pipeline run stats -- --offline   # dataset counts from cache, no network
```

## Architecture

Fully static site + precomputed JSON. No backend, no database. The pipeline emits JSON into `web/public/data/v1/` (committed to git); the web app fetches and renders it. This is why it's free to run and works offline.

**Data flow (one direction, gated at the end):**

```
CSV (Greco1899/scrape_ufc_stats)  ─┐
                                    ├─→ merge ─→ score ─→ sanitize ─→ web/public/data/v1/*.json
Wikipedia (MediaWiki API)          ─┘   (internal model, winner-bearing)   (published, winner-free)
```

- **`shared/`** — the single source of truth for what may be published. `src/schema.ts` is a **strict Zod whitelist** (`.strict()` everywhere); `src/names.ts` normalizes/sorts fighter names; `src/spoilerPatterns.ts` is the forbidden-pattern regex set. Both `pipeline` and `web` import from here, so the whitelist is defined once.
- **`pipeline/`** — TypeScript run via `tsx`. `src/cli.ts` orchestrates: `fetch/` (disk-cached HTTP, Wikipedia throttled 1.1s/req) → `parse/` → `merge/` (event matching by date±1d + name similarity; fight matching by surname sets) → `score/` → `emit/sanitize.ts` (the firewall) → `emit/writeJson.ts` → `audit/spoilerAudit.ts`. The internal model (`src/model.ts`) holds winner-bearing data in *source* order and must only reach disk through `sanitize.ts`.
- **`web/`** — Vite + React + TS PWA. `lib/spoilerLevel.tsx` (context, 1|2, localStorage), `lib/dataClient.ts` (fetch + re-validate against the shared schema), `components/FightRow.tsx` (per-level rendering + reveal), `pages/`.

## The spoiler boundary — do not weaken

Two distinct guarantees, and they are not the same strength:

1. **Hard (structural):** winner-identifying data — W/L outcomes, "def." notation, judge scorecards, per-fighter stats, bonus-recipient names, and meaningful fighter ordering — **has no representation in the published schema and therefore cannot exist in any output file.** Enforced by: the `.strict()` Zod schema (unknown key = rejected), `spoilerAudit.ts` (regex scan + structural checks, gates every pipeline run and CI build), alphabetical fighter sorting in `sanitize.ts`, and a canary test that sanitizes the same fight with the winner flipped and asserts byte-identical output.
2. **Soft (UX):** spoiler levels 1/2 and the per-fight reveal gate data that *is* in the JSON (excitement, method, round) via the UI only.

Rules when touching the pipeline or schema:
- **`sanitize.ts` builds every published field explicitly — never spread the internal object.** A spread is how a new internal field leaks. Adding a published field means adding it to the Zod schema deliberately (which forces a spoiler review) *and* to the explicit constructor.
- Scorecards and bonus-recipient names are discarded at *parse* time (`parse/csvResults.ts`, `parse/wikiEventPage.ts`), never stored even internally.
- Draws and no-contests must stay indistinguishable from decisions/finishes at levels 1–2 — they are themselves outcome spoilers. `resultClass` is only `early | distance`; NC gets `excitement: null` with the shared neutral phrase.
- The "why this rating" text comes exclusively from the fixed `WHY_VOCAB` in the schema — no names, rounds, methods, or winner verbs. Round-timing bonuses are deliberately unexplained.
- After any pipeline change, `npm run audit` and `npm test` must be green before committing emitted data.

## Data source constraints (learned the hard way)

- **ufcstats.com is behind a JS anti-bot wall — do not scrape it.** Historical stats come from the `Greco1899/scrape_ufc_stats` CSVs, treated as a frozen back-catalogue (last refresh ~2026-05-21). Raw CSVs cache in `pipeline/.cache/` (gitignored).
- **Wikipedia is the live source** for events after the CSV cutoff, via the MediaWiki `action=parse` API with a descriptive User-Agent and 1.1s throttle. ~200 unthrottled requests trip HTTP 429. The full backfill is committed to `pipeline/data/wikiExtract.json` (spoiler-safe) so CI never re-fetches ~790 pages.
- Many pre-2016 event stubs redirect to "20XX in UFC" year-summary pages whose first table is *not* the event card — these are detected and skipped.
- Fighter ring-name/legal-name aliases (e.g. Cris Cyborg) live in `pipeline/src/config.ts` `FIGHTER_ALIASES`; scoring weights and `MANUAL_EVENT_ALIASES` are there too.

## Deploy

GitHub Pages via `.github/workflows/refresh-and-deploy.yml`: weekly cron (Mon 09:00 UTC) refreshes data, commits the diff, redeploys. Build uses `KO_BASE` env for the Pages base path (`vite.config.ts` reads it). If the Wikipedia parser ever breaks, the workflow fails loudly and the site keeps serving last-good committed data.
