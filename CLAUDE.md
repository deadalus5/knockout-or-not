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
npm run data:refresh   # CSV back-catalogue + Wikipedia (newer than CSV cutoff) + ESPN (last ESPN_LOOKBACK_DAYS)
npm run data:backfill  # one-time full Wikipedia backfill (throttled ~15 min); writes pipeline/data/wikiExtract.json
npm -w pipeline run stats -- --offline   # dataset counts from cache, no network
```

## Architecture

Fully static site + precomputed JSON. No backend, no database. The pipeline emits JSON into `web/public/data/v1/` (committed to git); the web app fetches and renders it. This is why it's free to run and works offline.

**Data flow (one direction, gated at the end):**

```
CSV (Greco1899/scrape_ufc_stats)  ─┐
Wikipedia (MediaWiki API)          ├─→ merge ─→ score ─→ sanitize ─→ web/public/data/v1/*.json
ESPN (unofficial JSON API)        ─┘   (internal model, winner-bearing)   (published, winner-free)
```

Source priority in `merge/`: CSV is the frozen back-catalogue base; Wikipedia is the source of record for results/bonuses after the CSV cutoff; ESPN fills in combined stats (its unique contribution — nothing else has stats post-cutoff) and whole events Wikipedia hasn't published yet.

- **`shared/`** — the single source of truth for what may be published. `src/schema.ts` is a **strict Zod whitelist** (`.strict()` everywhere); `src/names.ts` normalizes/sorts fighter names; `src/spoilerPatterns.ts` is the forbidden-pattern regex set. Both `pipeline` and `web` import from here, so the whitelist is defined once.
- **`pipeline/`** — TypeScript run via `tsx`. `src/cli.ts` orchestrates: `fetch/` (disk-cached HTTP, Wikipedia throttled 1.1s/req) → `parse/` → `merge/` (event matching by date±1d + name similarity; fight matching by surname sets) → `score/` → `emit/sanitize.ts` (the firewall) → `emit/writeJson.ts` → `audit/spoilerAudit.ts`. The internal model (`src/model.ts`) holds winner-bearing data in *source* order and must only reach disk through `sanitize.ts`.
- **`web/`** — Vite + React + TS PWA. `lib/dataClient.ts` (fetch + re-validate against the shared schema), `components/FightTable.tsx` (the progressive-reveal table: every detail is a sealed cell, clicking reveals only that cell; reveal state is transient, never persisted; ten columns including four combined-stat cells — sig strikes landed/attempted, per-30s pace, control-% bar), `components/ExplainerMasthead.tsx` (static first-run explainer), `pages/`. The per-30s pace is **derived client-side** in `lib/format.ts` from the published round/time (5-minute-round assumption, guarded to return null for legacy formats) — deliberately not a schema field, see the stale-client rule below.

## The spoiler boundary — do not weaken

Two distinct guarantees, and they are not the same strength:

1. **Hard (structural):** winner-identifying data — W/L outcomes, "def." notation, judge scorecards, per-fighter stats, bonus-recipient names, and meaningful fighter ordering — **has no representation in the published schema and therefore cannot exist in any output file.** Enforced by: the `.strict()` Zod schema (unknown key = rejected), `spoilerAudit.ts` (regex scan + structural checks, gates every pipeline run and CI build), alphabetical fighter sorting in `sanitize.ts`, and a canary test that sanitizes the same fight with the winner flipped and asserts byte-identical output.
2. **Soft (UX):** per-cell reveal gates data that *is* in the JSON (excitement, finish, method, round, combined stats) via the UI only — every cell starts sealed and reveals independently.

Rules when touching the pipeline or schema:
- **`sanitize.ts` builds every published field explicitly — never spread the internal object.** A spread is how a new internal field leaks. Adding a published field means adding it to the Zod schema deliberately (which forces a spoiler review) *and* to the explicit constructor.
- **Adding a schema field also breaks stale PWA clients**: deployed clients re-validate fetched JSON against the `.strict()` schema in their cached bundle, so an unknown key makes old clients reject new data until their service worker updates. Prefer deriving display values client-side from already-published fields (as the per-30s pace does); only add a schema field when the value genuinely can't be derived, and expect a brief breakage window for cached clients.
- Scorecards and bonus-recipient names are discarded at *parse* time (`parse/csvResults.ts`, `parse/wikiEventPage.ts`), never stored even internally. ESPN winner flags and play-by-play are likewise never read (`parse/espnEvent.ts`), and its per-fighter stats are summed into symmetric totals at parse time.
- Draws and no-contests must stay indistinguishable from decisions/finishes until the method cell is revealed — they are themselves outcome spoilers. `resultClass` is only `early | distance`; NC gets `excitement: null` with the shared neutral phrase.
- The "why this rating" text comes exclusively from the fixed `WHY_VOCAB` in the schema — no names, rounds, methods, or winner verbs. Round-timing bonuses are deliberately unexplained.
- After any pipeline change, `npm run audit` and `npm test` must be green before committing emitted data.

## Data source constraints (learned the hard way)

- **ufcstats.com is behind a JS anti-bot wall — do not scrape it.** Historical stats come from the `Greco1899/scrape_ufc_stats` CSVs, treated as a frozen back-catalogue (last refresh ~2026-05-21). Raw CSVs cache in `pipeline/.cache/` (gitignored).
- **Wikipedia is the source of record** for events after the CSV cutoff (results + FOTN/PERF bonuses), via the MediaWiki `action=parse` API with a descriptive User-Agent and 1.1s throttle. ~200 unthrottled requests trip HTTP 429. The full backfill is committed to `pipeline/data/wikiExtract.json` (spoiler-safe) so CI never re-fetches ~790 pages.
- **ESPN is the fast path + only post-cutoff stats source** — the *unofficial*, unauthenticated JSON API (`site.api.espn.com` scoreboard + `sports.core.api.espn.com` event detail; per-fight status and per-competitor statistics only exist behind `$ref` links, some on the internal `espn.pvt` domain which `fetch/espnSource.ts` rewrites to `.com`). It can break or vanish without notice, so **every consumer degrades gracefully**: any ESPN failure logs a warning, skips the fast path, and the run/site continues on Wikipedia + last-good data — an ESPN outage must never fail a pipeline run. Fetch scope is the last `ESPN_LOOKBACK_DAYS` (default 7, env-overridable — `ESPN_LOOKBACK_DAYS=60 npm run data:refresh` was used once on 2026-07-16 to backfill events that aged out before capture); captured events persist forever in the committed, winner-free `pipeline/data/espnExtract.json` (without it, stats would vanish from the next rebuild once an event ages out of the fetch window). ESPN provides **no bonuses** — those arrive via the weekend Wikipedia passes. Ambiguous methods map conservatively to `Other`; detail text is never invented.
- Many pre-2016 event stubs redirect to "20XX in UFC" year-summary pages whose first table is *not* the event card — these are detected and skipped.
- **Kaggle's "UFC DATASETS [1994-2025]" was evaluated (2026-07-16) and rejected as a source**: it ends 2025-09-06 (older than the Greco back-catalogue), offers no columns the current sources lack (its per-fighter `ctrl` is the same single control-time total — no source anywhere records a ground-vs-standing clock), and refreshes only when its author manually re-runs a Kaggle notebook against the bot-walled ufcstats.com. Don't re-litigate unless it gains a reliable refresh path.
- Fighter ring-name/legal-name aliases (e.g. Cris Cyborg) live in `pipeline/src/config.ts` `FIGHTER_ALIASES`; scoring weights and `MANUAL_EVENT_ALIASES` are there too.

## Deploy

GitHub Pages via `.github/workflows/refresh-and-deploy.yml` (refresh data → audit → commit diff → build → deploy). Build uses `KO_BASE` env for the Pages base path (`vite.config.ts` reads it). If the Wikipedia parser ever breaks, the workflow fails loudly and the site keeps serving last-good committed data.

Three-tier refresh cadence:
1. **`watch-events.yml`** polls the ESPN scoreboard every ~25 min during broadcast windows (Sat 21:00 – Sun 09:00 UTC, sparse Sun–Mon fallback). One curl + jq compare against the committed `index.json`; if a completed event is missing it dispatches `refresh-and-deploy.yml`, otherwise it no-ops in seconds. ESPN unreachable → silent no-op.
2. **Sunday 18:00 UTC** `refresh-and-deploy.yml` cron — Wikipedia bonus/consistency pass so FOTN/PERF bonuses land same-weekend.
3. **Monday 09:00 UTC** cron — the backstop pass.
