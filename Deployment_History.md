# Deployment History

Plain-language log of what changed on the live site and when. Newest first.

---

## 2026-09-02 — The "Fight" header is now centered and reveals the whole table

Commit `6451920`, deployed via GitHub Actions run 33612905434 and confirmed live.

- The "Fight" column header is now center-aligned like all the other headers.
- Clicking it reveals the entire table — every cell of every fight — and clicking it again hides everything. From a half-revealed table, the first click fills in the rest. Same feel as the existing column-header and fighter-name clicks.
- Also carried the CLAUDE.md note about keeping this log updated.

No data or spoiler-protection changes. All 121 tests, the build, the smoke check, and the spoiler audit were green before the push; the new behavior was checked in a real browser before deploying and confirmed in the live site's code afterwards.

(Housekeeping note: every push to `main` deploys automatically — the manual workflow dispatches logged here were an extra belt-and-braces trigger, not required.)

---

## 2026-09-01 (evening) — Finish descriptions now come from Wikipedia (separate session)

Commits `1f6cb0c` (pipeline change) and `fcaa6f9` (regenerated data), made in a different working session; deployed automatically on push (Actions run 33569308591).

- The finish description shown in the "Details" cell (e.g. "Punch to Head At Distance") now uses Wikipedia's wording everywhere it agrees with the recorded outcome, instead of ufcstats' text.
- This fixes a long-standing source defect: ufcstats glues two phrases together with no space ("Twister From Back ControlScottish twister") — 253 such values sat in the back catalogue, and one variant leaked a winner in July. The parser now keeps only the clean first part, drops anything that names a fighter, and the spoiler audit rejects glued text outright.
- All event files were regenerated with the new rule.

---

## 2026-09-01 (afternoon) — Table layout round: Details column moved, row reveal, centered cells, bold surnames

Two commits pushed and deployed together (GitHub Actions run 33562653094, verified live on the site afterwards). That deploy's data-refresh step also picked up and committed the routine `f45398b` data refresh.

**`10f9ba6` — Details column last + fighter-names row reveal**
- The "Details" column (finish description + bonuses) moved from 3rd position to the last column, after Time.
- Clicking a fight's fighter names now reveals that fight's whole row; clicking again hides it — same feel as the existing column-header click.

**`8f439e1` — Center data cells + bold-surname fighter names**
- All nine data columns and their headers are now center-aligned. The Fight column stays left-aligned so rows are easy to scan.
- Fighter names show only the surname in bold ("Umar **Nurmagomedov**"), including tricky ones ("**Du Plessis**", "**Rountree Jr.**"); single-word names stay fully bold. The first-run explainer demo matches.

No data or spoiler-protection changes in either commit. All tests, the build, the smoke check, and the spoiler audit were green before each push, and the new look was confirmed live after the deploy.

---

# Session record of 2026-07-21 (older format, kept for history)

Handoff record of everything changed and deployed in the Claude Code session of
2026-07-21 (America/New_York). Written at the user's request after they reported
the final spoiler fix **did not work** on their end; the user intends to retry in
a fresh session and will **not** deploy or use this version. Nothing in the repo
has been modified beyond what is listed below; this document itself is untracked
and uncommitted.

---

## Commits pushed to `main` this session (all deployed via GitHub Pages)

Every push to `main` triggers `.github/workflows/refresh-and-deploy.yml`
(build → deploy). All three deploys below completed successfully per
GitHub Actions.

### 1. `6939c72` — "Web UI overhaul: Apple-dark restyle, colorized reveals, toggle cells, marquee events"
*Pushed 2026-07-21 ~08:30 UTC. 18 files, +882/−322. Rebased onto the weekend's
CI data commits (`f380e51`, `b9dbe30`, `a386e13`, `7b4341f`) before pushing.*

Frontend/visual only — no pipeline or data changes:

- **Typography:** system SF Pro stack replaces three bundled `@fontsource`
  webfonts (removed from `web/src/main.tsx`, `web/package.json`,
  `package-lock.json`). Mixed case everywhere (former ALL-CAPS condensed style
  dropped). Layout widened: `#root` 720→1200px, table bleed 1280→1360px,
  2-column event grid ≥880px.
- **Color systems** (all in `web/src/styles.css` tokens + pure bucket helpers in
  `web/src/lib/format.ts`): method hues (KO/TKO red `#ff453a`, Submission green
  `#30d158`, Decisions blue `#4da2f8`, Draw/NC/Other gray, DQ bronze);
  temperature scales for sig-strikes landed / attempted / per-30s pace bucketed
  by real dataset quartiles (`landedHeatLevel`, `attemptedHeatLevel`,
  `per30HeatLevel` — thresholds 30/65/105/155, 60/135/240/350, 5/8/11/15);
  reverse-battery control bar (`controlLevel`: <25 green → ≥75 red).
- **Rating column removed end-to-end:** `rating` cell def + `CellKey` gone from
  `FightTable.tsx`; `ExcitementBadge.tsx` deleted; `heatColor`/`starString`
  helpers deleted; masthead demo cell, About-page "How the excitement score
  works" section, and "ratings pending full stats" copy removed/reworded.
  `excitement`/`stars` remain in the published JSON schema, just unrendered.
- **Toggle reveals:** clicking a revealed cell reseals it; column headers
  toggle whole columns (reveal remainder → reseal all). aria-labels flip
  Reveal/Hide. `FightTable.tsx` state machine changed from add-only to toggle.
- **Marquee events:** `isMarqueeEvent()` in `format.ts` (inverse rule: NOT
  Fight Night / UFC on <network> / Ultimate Fighter / UFC Live / Road to UFC);
  `.event-item.marquee` amber gradient hairline border in the home list.
- **Wordmark:** tri-color compound "KnockoutOrNot" (white / `--c-orange` /
  `--c-red`), the amber "KO" box icon removed. (`App.tsx` + CSS.)
- Docs updated: `README.md` column table, `CLAUDE.md` FightTable description,
  `Codebase_Explainer.md` (this commit also added that previously-untracked
  file to git).
- Tests updated/added throughout `web/src/test/` (format bucket boundaries,
  toggle behavior, marquee classifier). 61 pipeline + 41 web tests green at
  push time; build + smoke green; deploy verified live.

### 2. `061524c` — "Round colors: reversed temperature scale (R1 red/hottest → R5 blue)"
*Pushed 2026-07-21 ~17:12 UTC (same push as commit 3). 1 file, +6/−6.*

- `web/src/styles.css` only: the five `--rd-*` round tokens repointed from
  distinct hues (amber/teal/violet/pink/cyan) to the shared temperature tokens,
  reversed: R1 `--c-red`, R2 `--c-orange`, R3 `--c-yellow`, R4 `--c-teal`,
  R5 `--c-blue`. User had confirmed the color rendering worked locally before
  this was committed.

### 3. `b711b32` — "Fix winner leak via glued-whitespace method details"
*Pushed 2026-07-21 ~17:12 UTC. 7 files, +92/−22. This is the fix the user
reports did NOT work.*

**Incident being fixed:** the live Details cell for UFC 329 main event showed
`"toMcGregor knee injury"` — winner-revealing (names the injured/retired
fighter). Diagnosis established this session (see "Diagnosis" below).

Changes in the commit:

- `shared/src/names.ts`: new `textMentionsFighter(text, fighters)` — fighter
  name tokens of **4+ chars matched as substrings** of the normalized text
  (defeats glued whitespace like "toMcGregor"); 3-char tokens stay exact-token
  (avoids "tan"-in-"distance" false positives).
- `pipeline/src/emit/sanitize.ts`: `scrubMethodDetail` rewired to the shared
  helper (was exact token-set matching — the blind spot).
- `pipeline/src/audit/spoilerAudit.ts`: same rewire — the CI audit now FAILS
  on this leak class (verified: pre-fix it flagged exactly the 2 poisoned
  files).
- `pipeline/test/scoringAndSanitize.test.ts`: regression tests containing the
  two literal leaked strings + false-positive guards.
- `CLAUDE.md`: "frozen CSV" claim corrected; glued-text lesson documented.
- **Data regenerated** via `npm run data:refresh`:
  `web/public/data/v1/events/2026-07-11-ufc-329-mcgregor-vs-holloway-2.json`
  (f01 `methodDetail`: `"toMcGregor knee injury"` → `null`) and
  `web/public/data/v1/events/2024-03-30-ufc-fight-night-blanchfield-vs-fiorot.json`
  (f12 `methodDetail`: `"Kick to Body On GroundPetroski hit head on takedown
  attempt"` → `null` — a second instance of the same defect, live since 2024).
  All other emitted files byte-identical.

**Post-deploy verification performed** (GitHub Actions run 29851951663,
success): `curl` of both live JSON files on
`deadalus5.github.io/knockout-or-not` returned `methodDetail: null` and zero
occurrences of the glued strings. **Despite this, the user reports the change
did not work in their experience.** Not investigated further per user
instruction — see "Leads" below.

---

## Diagnosis of the spoiler incident (established this session, evidence-backed)

1. The upstream `Greco1899/scrape_ufc_stats` CSV back-catalogue — dormant since
   2026-05-21 — refreshed upstream on **2026-07-19 between 13:17 and 19:01 UTC**
   (CI logs: `csv: 774 events through 2026-05-16` → `csv: 781 events through
   2026-07-18`).
2. With recent events now present in the CSV, the merge made them CSV-based
   (designed priority); their `methodDetail` switched from Wikipedia's clean
   text to ufcstats' `DETAILS` strings.
3. The upstream CSV row for the McGregor fight is itself corrupted: DETAILS
   literally contains `toMcGregor knee injury` (whitespace-mangled scrape).
4. The pipeline **already had** name-scrubbing in both `sanitize.ts` and the
   audit, but both used exact token matching: `nameTokens("toMcGregor…")` yields
   `tomcgregor` ≠ `mcgregor`, so both defenses passed it, and CI deployed it in
   data commit `a386e13` (the 2026-07-19 19:01 UTC scheduled run — **before**
   any of this session's pushes; the UI work did not cause or touch it).
5. Wikipedia and ESPN were ruled out (their committed extracts are clean and
   byte-identical across the clean/poisoned runs; the UFC 329 wiki page was
   protected and unchanged since Jul 13).

## Deployments NOT made by this session

- `f380e51`, `b9dbe30`, `a386e13`, `7b4341f` — automated `data: refresh`
  commits by scheduled CI (Jul 19–20). `a386e13` is the commit that introduced
  the McGregor leak to production.

## Repo state at handoff

- `main` = `b711b32`, pushed, deployed, Actions green.
- Working tree clean except this untracked file (`Deployment_History.md`).
- Uncommitted local-only artifacts: none in the repo (session scratch files
  live outside it).
- Test suite status at last run: 63 pipeline + 41 web passing; `npm run audit`
  clean against the regenerated data; `npm run build` + `npm run smoke` green.

## Leads for the fresh session (observations only — nothing was attempted)

The user reports still seeing the problem after the fix deployed, while direct
`curl` of the live JSON shows it clean. Unverified hypotheses worth checking:

1. **PWA/service-worker caching**: the app is a PWA (vite-plugin-pwa,
   `generateSW`). If data requests are runtime-cached (or the app shell serves
   stale data until the SW updates), the user's installed/open client could
   keep showing the poisoned `methodDetail` from cache long after the origin is
   clean. A hard refresh / SW update cycle or cache-busting strategy for
   `data/v1/*` may be the real remaining issue.
2. **CDN/browser cache** on GitHub Pages for the event JSON.
3. The user may consider the detail regression itself unacceptable (Details now
   shows "None" for the McGregor fight rather than Wikipedia's clean
   "knee injury") — the merge currently prefers CSV details over Wikipedia's
   for CSV-covered events; restoring wiki-preferred details was deliberately
   not attempted as part of the hotfix.
