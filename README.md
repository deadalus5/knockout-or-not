# KnockoutOrNot

**Is the fight worth watching? Find out without finding out.**

KnockoutOrNot is a spoiler-free guide to UFC fights — every event back to
UFC 1, and every new card as it happens. It tells you whether a fight is
worth your time while making it impossible to learn **who won**.

### ▶ Use it here: **<https://deadalus5.github.io/knockout-or-not/>**

No install, no account. It's a PWA: add it to your home screen and it works
offline.

## How to use it

1. Open the [live site](https://deadalus5.github.io/knockout-or-not/) and
   pick an event from the list, or search for a fighter or event.
2. Every fight is a row of **sealed cells**, ordered left to right from
   vague to specific:

   | Rating | Finish | Method | Details | Sig. landed | Sig. attempted | Per 30s | Control | Round | Time |
   |---|---|---|---|---|---|---|---|---|---|
   | 1–100 excitement score | "Stoppage" or "Went the distance" | KO/TKO, Submission, Decision… | finish detail + bonuses | combined significant strikes landed | combined significant strikes attempted | attempted strikes per 30 seconds | share of the fight spent in grappling control | R1, R2, … | when it ended |

   The stat columns are **combined totals for both fighters** — they describe
   the fight, never a fighter, so they can't hint at the result.

3. **Tap a cell** to reveal that one detail — and only that one. Tap a
   **column header** to reveal that column for every fight on the card.
4. Reveals are never saved. Reload the page and everything is sealed again.

The winner is never shown, at any level of reveal. Draws and no-contests
are folded into the neutral outcomes so even those can't be inferred
without unsealing the method.

## Why you can trust it (the hard guarantee)

The winner never reaches your browser — it isn't hidden by the UI, it's
**absent from the data**. The build pipeline strips:

- win/loss outcomes and "X def. Y" notation
- judge scorecards
- per-fighter statistics (only symmetric combined totals are published)
- bonus recipient names (a "Performance of the Night" name is a winner leak)
- fighter ordering (always alphabetical, so order encodes nothing)

Every published file is validated against a strict whitelist schema
(`shared/src/schema.ts`) — unknown fields are rejected — and scanned by an
automated spoiler audit (`pipeline/src/audit/spoilerAudit.ts`) that gates
every pipeline run and every CI build. A canary test verifies the published
output is byte-identical no matter which fighter won. Open your browser's
developer tools if you like: there is no winner to find.

## How it stays fresh

A watcher workflow (`watch-events.yml`) polls ESPN's scoreboard every
~25 minutes during UFC broadcast windows and triggers a full data refresh
and redeploy as soon as an event finishes — new cards typically appear on
the site within the hour, fight stats included. Wikipedia remains the
source of record: scheduled passes on Sunday and Monday
(`refresh-and-deploy.yml`) re-pull it so post-fight bonuses get merged in
and scores re-computed. If any source breaks or parsing fails, the
workflows fail loudly (or skip the fast path) and the site keeps serving
the last good data.

## Repository layout

- `shared/` — the whitelist schema + name utilities used by everything
- `pipeline/` — data pipeline: CSV back-catalogue + Wikipedia recent events →
  merge → excitement scoring → sanitize → `web/public/data/v1/`
- `web/` — React + Vite PWA

## Development

```bash
npm ci                  # install
npm run dev             # local dev server
npm test                # all tests
npm run audit           # spoiler audit of committed data
npm run build && npm run smoke
npm run data:refresh    # refresh data: CSVs + Wikipedia events newer than the CSV cutoff
```

## Data sources

- Results & bonuses: [Wikipedia](https://en.wikipedia.org/wiki/List_of_UFC_events)
  (CC BY-SA 4.0), via the MediaWiki API, throttled with a descriptive User-Agent
- Historical statistics: [scrape_ufc_stats](https://github.com/Greco1899/scrape_ufc_stats)
  (source: ufcstats.com)
- Fresh results & statistics: ESPN's unofficial public JSON API, best-effort —
  it's undocumented and may break without notice; when it does, the site
  simply falls back to the weekly Wikipedia cadence

Not affiliated with the UFC.
