# KnockoutOrNot — The Codebase, Explained

This document walks through the entire codebase in detail, with plain-English explanations alongside the technical ones. It is written so that someone who has never seen the project — or never written code — can follow the big picture, while still being precise enough to serve as a technical reference.

---

## 1. What this project is

**KnockoutOrNot is a spoiler-free UFC fight guide.** It answers one question: *"Is this fight worth watching?"* — without ever telling you who won.

For every UFC fight in history it publishes things like: did it end in a finish or go to a decision, how exciting it was (a 1–100 score), how fast-paced it was, and combined statistics such as total significant strikes landed by *both fighters together*. What it never publishes, anywhere, in any form, is winner information.

> **In plain English:** imagine a friend who watched every UFC event, and you can ask them "should I watch this one?" — but they are physically incapable of blurting out who won. That's the product. The entire codebase is organized around making that incapability *structural* rather than a matter of trust.

Two facts shape everything else:

1. **It's a fully static site.** There is no server, no database, no API of its own. A data pipeline runs periodically, produces plain JSON files, commits them to this git repository, and GitHub Pages serves them alongside a React app. This is why the site is free to run and works offline.
2. **The spoiler guarantee is enforced by architecture, not discipline.** Winner data is destroyed at the earliest possible moment (parse time), the published file format has *no field* that could hold a winner, and multiple independent automated checks scan every output before it ships.

Live site: https://deadalus5.github.io/knockout-or-not

---

## 2. The bird's-eye view

```
  DATA SOURCES                    THE PIPELINE                        THE WEBSITE
┌──────────────────┐
│ CSV back-catalogue│──┐
│ (frozen history)  │  │   ┌───────┐  ┌───────┐  ┌──────────┐
├──────────────────┤  ├──▶│ merge │─▶│ score │─▶│ sanitize │──▶ web/public/data/v1/*.json
│ Wikipedia         │──┤   └───────┘  └───────┘  └──────────┘         │
│ (source of record)│  │      internal model         the             │  committed to git,
├──────────────────┤  │      (winner-bearing,       firewall         │  served by GitHub Pages
│ ESPN unofficial   │──┘       never published)                       ▼
│ API (fast + stats)│                                    React PWA fetches + re-validates
└──────────────────┘                                     and renders sealed "reveal" cells
```

The repository is an **npm workspaces monorepo** with three packages:

| Package | What it is | Plain English |
|---|---|---|
| `shared/` | The published-data contract: schema, name utilities, forbidden-pattern list | The rulebook both sides agree on |
| `pipeline/` | TypeScript scripts (run via `tsx`) that fetch, merge, score, sanitize, and write the JSON | The factory that makes the data |
| `web/` | A Vite + React Progressive Web App | The storefront that displays it |

Data flows in exactly one direction: sources → pipeline → committed JSON → browser. The browser never talks to any data source; it only fetches the JSON files this repo publishes.

---

## 3. The spoiler boundary — the core design

There are two guarantees, and they are deliberately different strengths:

**Guarantee 1 — hard, structural.** Winner-identifying data (win/loss outcomes, "X def. Y" notation, judge scorecards, per-fighter statistics, bonus recipient names, and meaningful fighter ordering) **has no representation in the published file format**. You cannot leak what you cannot express. Enforced by four independent mechanisms:

1. **A strict whitelist schema** (`shared/src/schema.ts`) — every published file is validated against it, and any unknown field is rejected outright.
2. **Alphabetical fighter ordering** (`shared/src/names.ts` + `pipeline/src/emit/sanitize.ts`) — sources like Wikipedia list the winner first, so order itself is a spoiler; the pipeline re-sorts every pair so order encodes nothing.
3. **An automated spoiler audit** (`pipeline/src/audit/spoilerAudit.ts`) — re-reads every emitted file from disk and scans it with forbidden-pattern regexes plus structural checks. It gates every pipeline run and every CI build.
4. **Canary tests** — the test suite takes the same fight, flips who won, runs it through the pipeline, and asserts the output is *byte-for-byte identical*. If any bit of output depended on the winner, these tests fail.

**Guarantee 2 — soft, UX-level.** Data that *is* published (excitement score, finish vs. decision, method, round, stats) is still mildly spoiler-ish — knowing a fight ended in round 1 tells you something. So the UI seals every cell of the fight table behind a redaction bar, and each click reveals exactly one cell. This is a courtesy layer, not a security layer: the data is in the JSON, and the About page says so honestly.

> **In plain English:** guarantee 1 is a bank vault — the winner physically isn't in the building, so even someone reading the raw files in browser dev-tools finds nothing. Guarantee 2 is a curtain — the excitement score is behind it, but it's your choice when to peek, one detail at a time.

Cross-cutting rules that fall out of this design:

- Scorecards and bonus-recipient names are discarded **at parse time** — they never exist even in the pipeline's internal, private model.
- Draws and no-contests must be indistinguishable from wins until the method cell is revealed (a draw is itself an outcome spoiler). The published `resultClass` is only `early` or `distance`; draws fold into `distance`, NCs into `early`.
- The "why this rating" text comes exclusively from a fixed 12-phrase vocabulary — no names, rounds, methods, or winner verbs can appear in it.
- `sanitize.ts` constructs every published field explicitly — **never** by spreading the internal object — so a newly added internal field cannot silently leak into output.

---

## 4. `shared/` — the contract (4 files)

### `shared/src/schema.ts` — the whitelist

Defines, using Zod with `.strict()` everywhere (unknown keys = rejected), the exact shape of everything that may be published. Because both the pipeline and the web app import this one file, the contract is defined exactly once.

**The three published artifacts:**

- **`index.json`** — the site's table of contents: `schemaVersion`, `generatedAt` timestamp, attribution strings, and one entry per event (`id`, `sport`, `org`, `name`, `date`, `location`, `fightCount`, `topExcitement` — the highest excitement score on the card, `dataQuality`).
- **`events/<id>.json`** — one file per event (781 of them, ~6.8 MB total) containing its full fight list. Each fight carries: `id`, `order`, `card` (main/prelim/early), `weightClass`, `titleFight`, `fighters` (always alphabetical), `scheduledRounds`, `resultClass` (`early`|`distance` — the only outcome fact), `excitement` (1–100 or null), `stars` (1–5 or null), `pace` (high/medium/low or null), `why` (phrases from the fixed vocabulary), `scoreConfidence` (full/basic/none), `stats` (combined totals, or null), and `reveal` (`round`, `time`, `method`, `methodDetail`, `bonuses`).
- **`search-index.json`** — a compact array of `{e: eventId, n: name, d: date, f: [fighter names]}` used for client-side search.

Note what is *absent*: there is no winner field, no per-fighter stat, no scorecard, no bonus-recipient name. That absence is the hard guarantee.

> **In plain English:** the schema is a customs checklist. Anything crossing the border into the published data must match an approved item on the list exactly; anything unlisted is confiscated (the validation throws and the pipeline fails).

### `shared/src/names.ts` — names as identity

Fighter names arrive in different spellings, orders, and scripts. This file normalizes them: `normalizeName` strips accents and punctuation and lowercases; `nameTokens` splits into words and drops generational suffixes (Jr., III…); `lastNameKey` extracts the surname; `sortFighters` orders a pair by surname-then-full-name. That deterministic sort is what makes fighter order meaningless in the output — and the audit verifies every published pair follows it.

### `shared/src/spoilerPatterns.ts` — the forbidden words

Four regexes that must never match any published text: the `def.` abbreviation Wikipedia uses for "defeated"; the `W/L` outcome codes from ufcstats; scorecard shapes like `29–28` (with a lookbehind so dates like `2026-06-27` don't false-positive); and winner words (`defeated`, `loser`, `victorious` — deliberately *not* "winner"/"victor", because those are real fighter names, e.g. Andre Winner). `scanForSpoilers(text)` runs them all. It is used by the pipeline audit, the smoke test, and the web test suite — the same tripwire at three layers.

### `shared/src/index.ts`

Just a barrel file re-exporting the other three, so everything imports from `@ko/shared`.

---

## 5. `pipeline/` — the factory

Run with `npm run data:refresh`. The orchestration lives in `cli.ts`; everything else is a stage.

### 5.1 The internal model — `src/model.ts`

The pipeline's private, in-memory representation (`InternalEvent`, `InternalFight`). This model *is* winner-bearing in one subtle way: fighters sit in **source order** (Wikipedia lists the winner first), which is why it must never reach disk except through the sanitizer. Even here, though, scorecards and per-fighter stats do not exist — they were discarded at parse. Stats are a symmetric `CombinedStats` object (both fighters' numbers summed).

> **In plain English:** the factory floor is allowed to know a little more than the shop window — but only the order the names arrived in. The genuinely dangerous stuff (scorecards, who out-struck whom) was shredded at the loading dock.

### 5.2 Fetching — `src/fetch/`

- **`httpCache.ts`** — every HTTP GET goes through a disk cache in `pipeline/.cache/` (gitignored) with ETag revalidation. If the network fails but a cached copy exists, the cached copy is served. An `--offline` mode serves cache only. A `beforeNetwork` hook lets each source throttle *only* when a real request is about to go out (cache hits are never throttled).
- **`csvSource.ts`** — fetches three CSVs from the `Greco1899/scrape_ufc_stats` GitHub repo (events, results, per-round stats). This is the historical back-catalogue. It's treated as **frozen** (last upstream refresh ~2026-05-21) because the original source, ufcstats.com, is behind a JavaScript anti-bot wall and cannot be scraped directly.
- **`wikiSource.ts`** — fetches Wikipedia pages via the official MediaWiki `action=parse` API, with a descriptive User-Agent and a **1.1-second throttle** between real requests (~200 unthrottled requests trip HTTP 429 rate limiting; learned the hard way).
- **`espnSource.ts`** — talks to ESPN's *unofficial, undocumented* JSON API: a scoreboard endpoint for "what events happened between these dates," and a per-event bundle where fight status and statistics hide behind `$ref` links (some pointing at ESPN's internal `espn.pvt` domain, which this file rewrites to `.com`). Because the API could vanish any day, **every failure degrades gracefully**: a failed stats fetch just means that fight publishes without stats; a failed event fetch means the run continues on Wikipedia + last-good data. An ESPN outage must never fail a pipeline run.

> **In plain English:** three suppliers with three personalities. The CSV is a sealed historical archive. Wikipedia is the reliable official record that's a bit slow. ESPN is the fast, chatty source that might stop answering the phone at any moment — so the pipeline is written to shrug whenever ESPN flakes.

### 5.3 Parsing — `src/parse/`

Parsing is where spoilers die. Each parser converts raw source material into the internal model, discarding forbidden data in the same breath.

- **`common.ts`** — shared field parsers: dates to ISO, weight-class cleanup, method classification, time formats ("3 Rnd (5-5-5)" → scheduled rounds + round lengths; old no-time-limit formats flagged `legacyFormat`), "23 of 38" stat pairs. `parseMethod` looks at the outcome column *only* to detect symmetric draw/NC codes — the W/L direction is never returned.
- **`csvEvents.ts` / `csvResults.ts` / `csvStats.ts`** — the CSV trio. `csvResults` discards judge scorecards at parse time (decision details are dropped; finish details like "Punch" are kept). `csvStats` is the key spoiler kill: the CSV has per-fighter, per-round rows, and this parser **sums both fighters' numbers together** into one symmetric total per fight — the fact of who out-struck whom ceases to exist right here. Fights are keyed symmetrically by event + sorted surnames so lookup can't depend on order.
- **`wikiEventList.ts`** — parses Wikipedia's "List of UFC events" page, picking the numbered *past events* table (the scheduled-events table isn't numbered — that's how they're told apart) and skipping cancelled rows.
- **`wikiEventPage.ts`** — parses one event's Wikipedia page: the results table (winner-first rows are immediately re-sorted alphabetically; scorecard parentheticals are regex-stripped) and the "Bonus awards" section. Bonus recipient names are used *only* to locate which fight earned the bonus, then discarded — a "Performance of the Night" name is a winner leak, so the published data only says *this fight* earned a performance bonus, never who.
- **`espnEvent.ts`** — parses an ESPN event bundle. Winner flags and play-by-play text are **never read**. Only fully completed events (and completed fights) are accepted — a live card returns null so the site can't freeze mid-event data. Per-fighter statistics are summed into symmetric totals at parse time, same as the CSV. Ambiguous method names map conservatively to `Other`; detail text is never invented.
- **`wikiExtract.ts` / `espnExtract.ts`** — readers/writers for two **committed** data stores in `pipeline/data/`:
  - `wikiExtract.json` (~2.9 MB, 771 events, 1993→present): the one-time full-Wikipedia backfill, cached forever so CI never has to re-fetch ~790 pages at 1.1s each (~15 minutes).
  - `espnExtract.json` (small, growing): every ESPN event ever captured. This matters because ESPN is only *fetched* for the last `ESPN_LOOKBACK_DAYS` (default 7, env-overridable), but it's the **only stats source after the CSV cutoff** — without this permanent store, an event's stats would vanish from the next rebuild once it aged out of the fetch window.

  Both stores are spoiler-safe (already sorted, symmetric, scrubbed), which is why they can live in a public repo.

### 5.4 Merging — `src/merge/`

Three sources describe the same real-world events with different names, dates (timezone drift), and spellings. The merge layer reconciles them.

- **`matchEvents.ts`** — matches events across sources by date (±1 day tolerance) then name similarity (Jaccard overlap of name tokens, with noise words like "UFC", "Fight Night", "ESPN" removed). A lone candidate on the exact date is accepted even with a weak name (UFC almost never runs two events in one day); otherwise similarity must be ≥ 0.4.
- **`matchFights.ts`** — matches a fighter pair to a fight in another source. Primary key: the sorted pair of surnames. Fallbacks handle transliteration (edit distance ≤1–2 for longer names, so Oleynik ≈ Oleinik), concatenated names ("Su Mudaerji" ≈ "Sumudaerji"), and ring-name aliases from `config.ts` (`FIGHTER_ALIASES`, e.g. Cris Cyborg ↔ Cristiane Justino).
- **`mergeEvents.ts`** — the orchestrator, encoding the source hierarchy:
  1. **CSV is the frozen base** — every historical event starts from it, with stats attached.
  2. **Wikipedia is the source of record** for everything after the CSV cutoff: results, methods, bonuses, card structure. A safety check rejects a weak same-date match unless the two events' fight lists actually overlap (guards the rare dual-event day).
  3. **ESPN fills in only what it uniquely has**: combined stats (nothing else has stats post-cutoff), card section and round format when missing, and whole events Wikipedia hasn't published yet. It never overrides Wikipedia's results, methods, or bonuses. It can also append fights that a half-edited Wikipedia table is still missing — handling the transitional hour when Wikipedia editors are mid-update.

> **In plain English:** think of three witnesses describing the same night out. The archive (CSV) has the definitive old records. Wikipedia is the careful notary whose account wins whenever there's a disagreement about *what happened*. ESPN is the fast friend who texts you numbers first — trusted for the stats and for breaking news, never for the official story.

### 5.5 Scoring — `src/score/`

- **`percentiles.ts`** — a tiny empirical-percentile class. The strike rate of every fully-statted fight in history forms a distribution; any fight's pace is then expressed as "faster than X% of all fights ever," which self-adjusts across eras instead of using magic absolute numbers.
- **`excitement.ts`** — the scoring engine. Three tiers, depending on available data:

  **Full score** (stats available): starts from weighted components — 30 points for a finish (decisions get a quarter of that), up to 22 points for strike-rate percentile, up to 18 for knockdown rate, 8 for submission attempts, 6 for reversals ("scrambles"), +6 for a round-1 finish, +4 for a final-round finish, +14 for a Fight of the Night bonus (or +7 for a Performance bonus), and a penalty of up to −12 for decisions dominated by control time ("wall-and-stall"). Clamped to 1–100. Stars are the score divided into five 20-point bands; pace buckets from the strike percentile (low < 33rd, medium < 66th, else high).

  **Basic score** (result known, no stats — typically wiki-only events): a coarser scale seeded by method (KO 62, Submission 58, Draw 44, Decision 38, DQ 25) plus the same style of bonuses. Marked `scoreConfidence: 'basic'` so the UI can flag "full stats pending."

  **Neutral** (no-contests, unratable legacy fights): everything null with the single shared phrase *"Not enough data to rate."* All such fights look identical — deliberately, because if NCs looked unique, the neutral phrase itself would be an outcome spoiler.

  The "why" phrases come only from the fixed `WHY_VOCAB` — e.g. *"Ended inside the distance," "Explosive striking exchanges," "Multiple knockdowns," "Championship stakes."* Round-timing bonuses (+6/+4) are deliberately *not* explained in the why-text, because "ended in round 1" is exactly what the sealed round cell protects.

  All weights live in `config.ts` (`SCORE`) so tests can reference them by name.

### 5.6 Emitting — `src/emit/`

- **`sanitize.ts` — THE FIREWALL.** The only door between the internal model and disk. It builds every published field explicitly, one by one (never spreading the internal object), re-sorts fighters alphabetically regardless of what the source did, runs the scorer, scrubs `methodDetail` of anything sharing a token with a fighter's name, computes `dataQuality` (wiki-only → `basic`; ESPN-only → `full` only if stats actually landed), slugifies the event id from date + name, and finally validates the result against the strict schema before returning it. Adding a published field therefore requires touching both the Zod schema (forcing a deliberate spoiler review) *and* this explicit constructor.
- **`writeJson.ts`** — writes the three artifact types, each schema-validated once more before hitting disk. One subtlety: `index.json` embeds a `generatedAt` timestamp, and a naive implementation would change it every run, making CI commit meaningless "changes" on every schedule tick. So `stableGeneratedAt` compares the new index (timestamp excluded) against the existing file and **reuses the old timestamp when nothing real changed** — a no-change refresh produces a byte-identical file and therefore no git commit.

### 5.7 Auditing — `src/audit/spoilerAudit.ts`

An independent, standalone check (`npm run audit`) that ignores everything the pipeline claims and simply reads every published file back from disk: regex-scans the raw text with `scanForSpoilers`, strict-parses against the whitelist schema, verifies every fighter pair is in canonical alphabetical order (a deviant order could encode the winner), and verifies no `methodDetail` quotes a participant. Any finding exits non-zero, which fails both the pipeline run and the CI build.

> **In plain English:** after the factory says "all clean," a separate inspector who doesn't work for the factory opens every box on the loading dock and checks again. Only if *both* agree does anything ship.

### 5.8 The orchestrator — `src/cli.ts`

Ties it together, in order: load CSVs → refresh the Wikipedia extract (re-fetch pages younger than 14 days to catch late bonus edits; fetch new pages after the CSV cutoff; back off 30s on HTTP 429 and abort fetching after 3 consecutive 429s) → refresh the ESPN extract (last 7 days; re-fetch events younger than 2 days to absorb late stat corrections; warn-and-continue on any failure) → merge → build the strike-rate percentile basis → sanitize every event → write JSON → run the audit, exiting 1 on any finding. Also provides `stats` (dataset counts, `--offline` capable) and `--backfill-bonuses` for the one-time full backfill.

`src/config.ts` holds every knob: paths, endpoints, the 1.1s Wikipedia / 0.3s ESPN throttles, `ESPN_LOOKBACK_DAYS`, the full `SCORE` weight table, and the manual alias maps.

---

## 6. `web/` — the storefront

A Vite + React 19 + TypeScript Progressive Web App. No state library, no CSS framework — plain React state and one hand-written stylesheet.

### 6.1 Data loading — `src/lib/dataClient.ts`

The only module that fetches data. Three functions (`loadIndex`, `loadEvent`, `loadSearchIndex`), each cached in memory as a promise so nothing is fetched twice per session. Crucially, **every payload is re-validated against the same strict Zod schema from `shared/`** before use — so even if a stale or tampered JSON file were served, an unexpected field would be rejected in the browser too. Event ids are checked against `^[a-z0-9-]+$` before being used in a URL. (Side effect worth knowing: because deployed clients validate strictly, *adding* a schema field breaks old cached PWA clients until their service worker updates — which is why display values are derived client-side where possible instead of added to the schema.)

### 6.2 Derived values — `src/lib/format.ts`

Pure helpers: UTC-pinned date formatting (no timezone drift), the heat color ramp for scores, star strings, and two derivations that are deliberately *computed in the browser* rather than published as schema fields:

- **`fightDurationMin`** — elapsed fight time from the published round + time, assuming 5-minute rounds. Guarded: if the fight went past round 1 and the scheduled format isn't a standard 3 or 5 rounder (early-UFC overtime formats had odd round lengths), it returns null rather than a wrong number.
- **`sigStrAttemptedPer30`** — the pace column: combined significant strikes attempted per 30 seconds of fight time, to one decimal. Uses combined totals only, so it describes *the fight*, never a fighter.

### 6.3 Search — `src/lib/search.ts`

Dependency-free scoring over the lazy-loaded search index: fighter-name prefix beats substring beats event-name match; results keep the index's newest-first order on ties. Winner-safe by construction — the index contains only names and dates.

### 6.4 The reveal table — `src/components/FightTable.tsx` (the heart of the UI)

One row per fight, nine columns ordered **vague → specific**: finish → method → details → sig strikes landed → attempted → per-30s pace → control bar → round → time. Every cell starts sealed; clicking toggles it (a second click reseals). The excitement score is still computed and published but no longer rendered as a column.

The mechanics, precisely:

- Reveal state is a single React `Set` of `"fightId:cellKey"` strings. Clicking a sealed cell reveals **only that cell**. Clicking a column header reveals that column for every fight in the table.
- A sealed cell renders *only* a striped redaction bar — the value is **not present in the DOM** (the cell's value function isn't even evaluated until revealed), so "inspect element" shows nothing.
- Reveal state is **never persisted** — no localStorage, no URL state. Navigate away and everything reseals. A test asserts localStorage stays empty after clicking every cell.
- The `finish` cell shows a neutral chip — "Stoppage" or "Went the distance" — into which draws and no-contests are folded, so the outcome type can't be inferred without unsealing `method`.
- Missing data renders graceful empty strings ("No data", "Not recorded", "Not rated") — this is what a freshly-published event with lagging ESPN stats looks like until the next refresh upgrades it.
- Accessibility: sealed cells are real `<button>`s with `aria-pressed` and labels like "Reveal method — Fighter A vs Fighter B"; fighters are listed alphabetically in the row header.

### 6.5 The rest of the components and pages

- **`EventListItem.tsx`** — a home-list row: name, date, location, fight count, and a "full stats pending" tag for `basic`-quality events. Marquee events (numbered PPVs + named specials) get an amber gradient hairline. Deliberately shows **no excitement info** on the list — even a hot badge on a card you haven't watched is information you didn't ask for.
- **`SearchBar.tsx`** — type-ahead search; loads the index on first focus; Enter jumps to the top hit.
- **`ExplainerMasthead.tsx`** — the dismissible first-run explainer, demonstrating the mechanic with a hardcoded, fully-unsealed UFC 229 (Khabib vs. McGregor) example whose caption ends "Who won stays sealed forever." Dismissal is the one thing stored in localStorage.
- **`pages/HomePage.tsx`** — explainer + search + the event list, grouped by month, with infinite scroll (30 at a time via IntersectionObserver).
- **`pages/EventPage.tsx`** — one event, its fights split into Main card / Prelims / Early prelims sections, one FightTable per section, plus the hint "Every cell is sealed. Tap one to reveal only that detail."
- **`pages/AboutPage.tsx`** — an honest methodology page: what's structurally impossible vs. what's UI courtesy, how the score works, what "combined stats" means, data sources and licensing, and live freshness (event count + last-updated from `index.json`).
- **`App.tsx` / `main.tsx`** — router (`/`, `/event/:id`, `/about`) with a `basename` that respects GitHub Pages sub-path hosting; entry point mounts the app and cleans up localStorage keys from retired features.
- **`styles.css`** — the "vault" design system: dark charcoal, one amber accent, three typefaces (poster display, prose grotesk, data mono). The sealed cell is literally styled as a document-redaction bar, with per-column width variation for texture and an "unseal" animation on reveal (disabled under `prefers-reduced-motion`).

### 6.6 PWA / offline — `web/vite.config.ts`

`vite-plugin-pwa` with auto-updating service worker. Caching strategy: the app shell and fonts are precached; the ~780 event JSON files are **not** (too many) — instead, `index.json` and the search index use *network-first* (fresh when online, cached when offline) and event files use *stale-while-revalidate* (instant load, refreshed in the background). The build reads `KO_BASE` for the GitHub Pages base path, and copies `index.html` to `404.html` so deep links like `/event/xyz` work on Pages (its 404 page boots the SPA, which then client-routes).

---

## 7. Automation — how the site stays fresh

Three GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`** — on every push/PR: typecheck → tests → **spoiler audit** → build → **smoke test**. The smoke test (`scripts/smoke.mjs`) boots a real preview server against the built output and asserts the data is present (≥700 events), the PWA artifacts exist, and — one more tripwire — the served event JSON matches no spoiler pattern and contains no `winner`/`outcome` key.
- **`refresh-and-deploy.yml`** — the full cycle: refresh data → audit → commit the diff (only if something actually changed — see the `generatedAt` stability trick above) → build → deploy to GitHub Pages. Runs on a schedule and on demand.
- **`watch-events.yml`** — the fast path. During broadcast windows (Saturday 12:00 UTC through Sunday 09:00 UTC, covering both international afternoon cards and US late-night cards) it polls ESPN's scoreboard **every ~10 minutes** with a single curl + jq comparison against the committed `index.json`. If a completed event is missing from the site, it dispatches the full refresh-and-deploy workflow. A **dispatch damper** skips triggering if a refresh is already running or finished under 30 minutes ago (so a broken ESPN feed can't queue builds all night), and fails *open* — if the damper check itself errors, it dispatches anyway. If ESPN is unreachable, the whole thing is a silent no-op.

The resulting refresh cadence, slowest to fastest:

1. **~20–40 min after a card ends** — the watcher catches the completed event and triggers a refresh. The event publishes immediately even if some stats are missing (those cells show "No data").
2. **Sunday 12:00 UTC** — a catch-up pass that upgrades any `basic`-quality event whose ESPN stats lagged, and picks up early Wikipedia bonus edits.
3. **Sunday 18:00 UTC and Monday 09:00 UTC** — Wikipedia bonus/consistency passes, so Fight of the Night / Performance bonuses land the same weekend, with Monday as the backstop.

If anything breaks — ESPN vanishes, the Wikipedia parser hits a page format change — workflows fail loudly (or no-op silently, for the ESPN fast path) and the site keeps serving the last good committed data. Degradation is always graceful; the site never shows broken or partial-in-a-bad-way data.

> **In plain English:** a lookout checks ESPN every ten minutes on fight nights and rings the factory bell the moment a card finishes. The factory does a full production run (with both inspectors), ships the update, and a Sunday/Monday cleanup crew fills in whatever the fast pass missed — bonuses and any stats that were slow to arrive.

---

## 8. Testing — the safety nets

**Pipeline tests** (`pipeline/test/`, Vitest):

- `csvParsers.test.ts` / `wikiParsers.test.ts` / `espnParser.test.ts` — each parser against realistic fixtures, always asserting spoilers died at parse: no `def.`, no scorecards, no W/L codes, bonus names discarded.
- **The canary tests** (the crown jewels, in the wiki, ESPN, and sanitize suites): take the same fight, flip who won in the raw input, run the full parse/sanitize path, and assert the output is **byte-for-byte identical**. This is the executable proof that no published byte depends on the winner.
- `espnMerge.test.ts` — the source-hierarchy rules: ESPN enriches but never overrides Wikipedia; ESPN-only events publish; stat-less ESPN events stay `basic`.
- `scoringAndSanitize.test.ts` — exact expected scores for known inputs (a round-1 title KO scores 83), the stall penalty, neutral NC handling, and the matching heuristics.
- `schema.test.ts` — the whitelist rejects unknown keys like `winner`, and free-text why-phrases throw.
- `writeJson.test.ts` — `index.json` stays byte-identical when nothing changed and re-stamps when the event list grows.

**Web tests** (`web/src/test/`, Vitest + Testing Library):

- `fightTable.test.tsx` — sealed-by-default (derived values must be absent from the HTML), single-cell reveal isolation, column reveal, empty states, the legacy-format pace guard, no localStorage persistence, and `scanForSpoilers` returning clean at every reveal state — including a draw fight showing no "draw" text until method is unsealed.
- `appIntegration.test.tsx` — runs the app against the *real committed dataset* (fetch mocked to disk) and scans the rendered DOM for spoiler patterns at multiple interaction states.
- `format.test.ts` — the duration and pace derivations, including all the null-guard edge cases.

Plus the two runtime-level checks that run in CI on every build: `npm run audit` (published files) and `npm run smoke` (served files).

---

## 9. Commands cheat-sheet

```bash
npm ci                  # install everything (all three workspaces)
npm run dev             # web dev server at http://localhost:5173
npm test                # all tests (pipeline + web)
npm run typecheck       # tsc --noEmit across shared, pipeline, web
npm run audit           # spoiler audit of the committed published data
npm run build           # typecheck + vite build (PWA) + SPA 404 fallback
npm run smoke           # boots the built site, asserts data + PWA + no spoilers

npm run data:refresh    # the pipeline: CSVs + recent Wikipedia + recent ESPN
npm run data:backfill   # one-time full Wikipedia backfill (throttled, ~15 min)
npm -w pipeline run stats -- --offline    # dataset counts from cache, no network

# Single test file / single test by name:
npm -w pipeline run test -- scoringAndSanitize
npm -w web run test -- -t "reveal flow"
```

---

## 10. Things that are the way they are for a reason

A short list of decisions that look odd until you know the history (details in `CLAUDE.md`):

- **ufcstats.com is never scraped** — it's behind a JS anti-bot wall. The frozen CSV back-catalogue is the workaround.
- **Wikipedia is throttled at 1.1s/request** and the full backfill is committed (`wikiExtract.json`) so CI never re-fetches ~790 pages.
- **`espnExtract.json` must stay committed** — ESPN is only fetched 7 days back, and without the durable store, post-CSV-cutoff stats would silently vanish from the next rebuild.
- **The per-30s pace is computed client-side, not published** — adding a schema field breaks stale PWA clients (they strictly validate against the schema baked into their cached bundle), so derivable values are derived.
- **Kaggle's UFC dataset was evaluated (2026-07-16) and rejected** — older than the existing back-catalogue, no unique columns, no reliable refresh path.
- **Some pre-2016 Wikipedia event stubs redirect to "20XX in UFC" year pages** whose first table is a different event's — these are detected and skipped.
- **Fighter aliases** (ring names vs. legal names) live in `pipeline/src/config.ts`, alongside all scoring weights and throttles.

---

*Generated 2026-07-16 from a full read of the codebase. If the code and this document ever disagree, trust the code — and ideally, update this file.*
