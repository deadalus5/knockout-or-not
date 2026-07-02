# KnockoutOrNot

**Is the fight worth watching? Find out without finding out.**

KnockoutOrNot is a spoiler-free guide to UFC fights. It tells you whether a
fight ended early or went the distance, how exciting it was, and how fast the
pace was — while making it impossible to learn **who won**.

## The trust boundary

The winner never reaches your browser. The data pipeline strips:

- win/loss outcomes and "X def. Y" notation
- judge scorecards
- per-fighter statistics (only symmetric combined totals are published)
- bonus recipient names (a "Performance of the Night" name is a winner leak)
- fighter ordering (always alphabetical, so order encodes nothing)

Every published file is validated against a strict whitelist schema
(`shared/src/schema.ts`) — unknown fields are rejected — and scanned by an
automated spoiler audit (`pipeline/src/audit/spoilerAudit.ts`) that gates
every pipeline run and every CI build. A canary test verifies the published
output is byte-identical no matter which fighter won.

What the UI hides per detail level (excitement, method, round) is a softer,
UX-level gate — but the winner is not a gate, it's absent.

## Layout

- `shared/` — the whitelist schema + name utilities used by everything
- `pipeline/` — data pipeline: CSV back-catalogue + Wikipedia recent events →
  merge → excitement scoring → sanitize → `web/public/data/v1/`
- `web/` — React + Vite PWA (installable, offline-capable)

## Running locally

```bash
npm ci
npm run dev        # dev server on http://localhost:5173
npm test           # all tests
npm run audit      # spoiler audit of committed data
npm run build && npm run smoke
```

## Refreshing data

```bash
npm run data:refresh    # CSVs + Wikipedia events newer than the CSV cutoff
npm run data:backfill   # one-time full Wikipedia backfill (throttled, ~15 min)
```

In CI, `refresh-and-deploy.yml` refreshes weekly (Mon 09:00 UTC), commits the
data diff, and redeploys GitHub Pages. If parsing ever fails, the workflow
fails loudly and the site keeps serving the last good data.

## Data sources

- Results & bonuses: [Wikipedia](https://en.wikipedia.org/wiki/List_of_UFC_events)
  (CC BY-SA 4.0), via the MediaWiki API, throttled with a descriptive User-Agent
- Historical statistics: [scrape_ufc_stats](https://github.com/Greco1899/scrape_ufc_stats)
  (source: ufcstats.com)

Not affiliated with the UFC.
