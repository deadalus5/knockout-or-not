# Moving KnockoutOrNot to knockoutornot.com — the changeover guide

> **Where we are:** Stage 0 in progress. Last updated 2026-09-02. Scroll to the **Status log** at the bottom for the blow-by-blow.

This document is the single checklist for moving the site from its GitHub address to its real domain. It is written for a reader who does not live in computer jargon. Every step says **who** does it (**YOU** or **CLAUDE**), **why**, and **how we know it worked**. Nothing here should be done out of order; each stage is safe on its own and can be undone.

---

## 1. What we are doing, and why

Today the site lives at `https://deadalus5.github.io/knockout-or-not/`. That address is a free GitHub "Pages" address; it works, but it is long, it belongs to GitHub, and it says nothing about the product. You bought **knockoutornot.com** through Cloudflare. The goal is that typing `knockoutornot.com` opens the site, with everything working exactly as it does today: the sealed cells, the app-install ("add to home screen") behaviour, offline use, the automatic data updates after every fight card, and the spoiler protections.

We are moving the site's **hosting** to Cloudflare as well (not just pointing the name at GitHub). Cloudflare will store and serve the site's files from its worldwide network. The automatic data-refresh machinery stays exactly where it is (GitHub Actions); it simply uploads the finished site to Cloudflare instead of to GitHub Pages at the end. The old GitHub address will keep working as a signpost that forwards visitors to the new domain.

## 2. The plan in one picture

```
Stage 0  Prep            paperwork, safety settings, one token from you        nothing visible changes
Stage A  Hidden copy     site uploaded to Cloudflare at a test address           nothing visible changes
Stage B  Go live         knockoutornot.com switched on; www forwards to it       new domain works; old one still works
Stage C  Signpost        old GitHub address becomes a "we moved" forwarder       old links land on the new domain
Stage D  Paperwork       docs, project notes, optional hardening                 nothing visible changes
```

Each stage ends with checks. If a check fails, we undo that stage (see "How to undo" in each) and nothing downstream has happened yet.

## 3. Words used in this document

- **Domain / DNS.** `knockoutornot.com` is the domain. DNS is the phone book that tells browsers which computers answer for that name. Cloudflare keeps this phone book for us; during the move Cloudflare fills in the entries itself.
- **Worker (Cloudflare).** Cloudflare's name for "a thing that answers web requests." Ours is the simplest kind: it just hands out the site's files. No code runs, which is why it is free and has no daily request limit.
- **GitHub Actions / the workflow.** The robot that already runs on GitHub: it fetches new fight data, checks it for spoilers, builds the site, and publishes it. We are adding one more step to it ("upload to Cloudflare").
- **API token.** A long random password that lets the GitHub robot talk to your Cloudflare account. It is deliberately limited: it can only publish this Worker, nothing else (it cannot touch DNS, billing, or other sites). It lives only inside GitHub's locked "secrets" vault. Neither Claude nor any file in the project ever sees it.
- **Secret (GitHub).** GitHub's vault for tokens. Values can be written in, but never read back out by people; only the robot can use them, and only for the job we allow.
- **Service worker.** A small helper the site installs in each visitor's browser so the app opens instantly and works offline. Because it belongs to the *address*, the one installed from the old GitHub address cannot be moved; instead we replace it with a tiny "clean up and go to the new domain" version.
- **Redirect / forwarder.** Automatically sending a visitor from one address to another. `www.knockoutornot.com` forwards to `knockoutornot.com`; the old GitHub address forwards to the new domain.
- **The old address.** `https://deadalus5.github.io/knockout-or-not/`.

## 4. Who does what

| Task | Who | Why it has to be you |
|---|---|---|
| Cloudflare account safety (two-factor login) | **YOU** | Only the account owner can do it |
| Copy two IDs from Cloudflare (Account ID, Zone ID) | **YOU** | Visible only when logged in; they are identifiers, not secrets, so sharing them with Claude is fine |
| Create the limited API token | **YOU** | The token is shown once, to the person creating it; it must never pass through Claude or a file |
| Put the token into GitHub's secrets vault | **YOU** | Same reason: only you should ever see the value |
| Four one-time switches in the Cloudflare dashboard (HTTPS-always, the `www` entry, the `www` forwarding rule, analytics mode) | **YOU** | Kept off the token on purpose so a leaked token could never change DNS or rules |
| Everything else: files, code, GitHub settings, testing, documentation | **CLAUDE** | Repeatable, checkable, and needs no credentials |

Total hands-on time for you: roughly 15 minutes across Stages 0 and B.

---

## 5. Stage 0 — Prep (nothing visible changes)

**Goal:** get the paperwork and safety rails in place before anything is deployed.

### Checklist

- [x] **CLAUDE** — Write this guide and commit it to the project so it travels with the code.
- [x] **CLAUDE** — Teach the project to ignore local secret files (`.env`, `.dev.vars`, `.wrangler/`) so a token could never be committed by accident. (Preventive: no such files exist today.)
- [x] **CLAUDE** — Add the plain-language change log (`Deployment_History.md`) to the repository, as agreed.
- [x] **CLAUDE** — Create a locked GitHub "environment" named `cloudflare`, restricted to the `main` branch. Only the publishing job on `main` can ever read secrets stored there.
- [ ] **YOU** — Cloudflare: **My Profile → Authentication**: make sure two-factor authentication is on. *(Why: this account will now hold the live site.)*
- [ ] **YOU** — Cloudflare: **Workers & Pages → Overview**. If Cloudflare asks you to choose a `*.workers.dev` subdomain, pick any name (for example `deadalus`). On the right side, under **Account details**, copy the **Account ID** and send it to Claude. *(Why: the test copy in Stage A lives at `knockoutornot.<your-subdomain>.workers.dev`, and the robot needs the Account ID to know which account to publish into.)*
- [ ] **YOU** — Cloudflare: click the **knockoutornot.com** domain → its **Overview** page → scroll to the **API** box on the right → copy the **Zone ID** and send it to Claude. *(Why: Stage B uses it so the token can stay as limited as possible.)*
- [ ] **YOU** — Cloudflare: **Manage Account → API Tokens → Create Token → Create Custom Token** (bottom of the page). Fill in:
  - **Token name:** `github-actions-knockoutornot`
  - **Permissions** (three rows, use the "+ Add more" link):
    1. `Account` · `Workers Scripts` · `Edit`
    2. `Zone` · `Workers Routes` · `Edit`
    3. `Zone` · `Zone` · `Read`
  - **Account Resources:** Include → *your account*
  - **Zone Resources:** Include → **Specific zone** → `knockoutornot.com`
  - **TTL:** leave blank (the robot needs it indefinitely; we can roll it any time)
  - Click **Continue to summary → Create Token**. Copy the token. **It is shown exactly once.** Keep the tab open until the next step is done.
- [ ] **YOU** — Put the two values into GitHub's vault. Either way works:
  - **Web:** `https://github.com/deadalus5/knockout-or-not/settings/environments` → click **cloudflare** → **Environment secrets → Add environment secret**. Add `CLOUDFLARE_API_TOKEN` (paste the token) and `CLOUDFLARE_ACCOUNT_ID` (paste the Account ID).
  - **Or Terminal** (your own Terminal app, not the Claude session): run `gh secret set CLOUDFLARE_API_TOKEN --env cloudflare -R deadalus5/knockout-or-not`, paste the token at the hidden prompt, press Enter; then the same with `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **YOU** — Tell Claude: "secrets are in", plus the Account ID and Zone ID.

### How we know it worked
- GitHub shows two secrets under the `cloudflare` environment (names only; values are never displayed).
- Claude can see the environment and its branch rule from the command line; the secrets' *existence* is confirmed by the first Stage A publish succeeding.

### How to undo
- Nothing to undo. Delete the token in Cloudflare (**Manage Account → API Tokens → ⋯ → Delete**) if you change your mind.

---

## 6. Stage A — Hidden copy on Cloudflare (nothing visible changes)

**Goal:** publish the site to Cloudflare at a *test* address only (`knockoutornot.<subdomain>.workers.dev`) and prove it is a perfect copy. The public site keeps running on GitHub Pages untouched.

### Checklist
- [x] **CLAUDE** — Add the Cloudflare publishing tool (`wrangler`) to the project at a fixed version, so every publish uses the exact same tool.
- [x] **CLAUDE** — Write the Worker description file `web/wrangler.jsonc` (name, "serve these files", "unknown pages open the app", test address on, custom domain off for now).
- [x] **CLAUDE** — Write `web/public/_headers`: browser caching rules (fingerprinted files cached for a year, the app shell always re-checked) and two standard safety headers.
- [ ] **CLAUDE** — Make the site's data loader refuse a response that is not actually data. *(Why: on Cloudflare a missing data file comes back as the app page with an "OK" status instead of a "not found" error, so the loader must check the content type, not just the status.)* Add a test for it.
- [ ] **CLAUDE** — Add a `deploy-workers` job to the GitHub workflow: build → smoke test → upload to Cloudflare using the token from the `cloudflare` environment. The existing GitHub Pages job is left exactly as it is.
- [ ] **CLAUDE** — Run every local check (types, tests, spoiler audit, build, smoke, a "dry run" of the publish), commit, push, and watch the workflow run.
- [ ] **CLAUDE** — Verify the test address (see below).

### How we know it worked
Against `https://knockoutornot.<subdomain>.workers.dev`:
- Home page, an event page opened directly by its address, and the "How it works" page all load.
- The install file (`manifest.webmanifest`), the offline helper (`sw.js`), and the data files (`data/v1/index.json`) are served with the right types and caching rules; the data matches what GitHub Pages serves, event for event.
- A browser test: the app installs its offline helper, reloads fine with the network switched off, and shows no errors.
- The served event data passes the same spoiler regexes the smoke test uses.

### How to undo
- Remove the new job from the workflow (or delete the Worker in Cloudflare: **Workers & Pages → knockoutornot → Settings → Delete**). Nothing public changed.

---

## 7. Stage B — knockoutornot.com goes live

**Goal:** attach the real domain to the Worker. The old GitHub address keeps serving the full site throughout, so there is no moment where the site is down.

### Checklist
- [ ] **YOU** — Cloudflare → **Domains** (or the account home): confirm knockoutornot.com shows **Active**.
- [ ] **YOU** — Cloudflare → knockoutornot.com → **SSL/TLS → Edge Certificates** → turn **Always Use HTTPS** **On**. *(Why: anyone typing `http://` gets sent to the secure `https://` version. Off by default.)* Leave the encryption mode at its default; just make sure it is not "Off".
- [ ] **YOU** — Cloudflare → knockoutornot.com → **DNS → Records → Add record**: Type **A**, Name **www**, IPv4 address **192.0.2.0**, Proxy status **Proxied** (orange cloud, on), TTL Auto → **Save**. *(Why: a placeholder so Cloudflare has something to intercept when someone types `www.`. The address 192.0.2.0 is a reserved dummy; nothing lives there. This is Cloudflare's documented recipe.)*
- [ ] **YOU** — Cloudflare → knockoutornot.com → **Rules → Overview → Create rule → Redirect Rule** → pick the template **"Redirect from WWW to Root"** → **Deploy**. *(Why: `www.knockoutornot.com/anything` now forwards permanently to `knockoutornot.com/anything`, keeping any `?query`.)*
- [ ] **YOU** — Cloudflare → **Web Analytics** → find knockoutornot.com → **Manage site** → choose **Enable with JS Snippet installation** → copy the small `<script …>` snippet it shows and send it to Claude. *(Why: this is the cookie-free visitor counter you asked for. The "snippet" mode is chosen because the automatic mode interferes with the app's offline caching.)*
- [ ] **YOU** — Verify-only glance: **Security → Settings**: Bot Fight Mode should be **off**; **Speed → Settings → Content Optimization**: Rocket Loader should be **off**. Both are off by default; both would inject scripts into the site if on.
- [ ] **CLAUDE** — Add the analytics snippet to the site's page template.
- [ ] **CLAUDE** — Update `web/wrangler.jsonc`: custom domain `knockoutornot.com` on (with the Zone ID), test address off. Push. Cloudflare creates the DNS entry and the certificate itself within minutes.
- [ ] **CLAUDE** — Push one more small commit afterwards. *(Why: the publishing tool runs an extra permission-dependent check only from the second publish onwards; we want to see it pass while we are watching.)*
- [ ] **CLAUDE** — Verify (see below).

### How we know it worked
- `https://knockoutornot.com` shows the site with a valid padlock; every Stage A check passes there too.
- `http://knockoutornot.com/about` forwards to `https://knockoutornot.com/about`.
- `https://www.knockoutornot.com/event/x?y=1` forwards to `https://knockoutornot.com/event/x?y=1`.
- The test `workers.dev` address no longer answers.
- Exactly one analytics snippet appears in the page.
- A browser test on the real domain: installable, works offline, no errors.
- `https://deadalus5.github.io/knockout-or-not/` still serves the full site (untouched until Stage C).

### How to undo
- Set the custom domain off in `web/wrangler.jsonc` and republish, or in Cloudflare: **Workers & Pages → knockoutornot → Settings → Domains & Routes → remove**. Then also delete the leftover certificate under **SSL/TLS → Edge Certificates** (Cloudflare does not remove it automatically). The old address never stopped working.

---

## 8. Stage C — The old address becomes a signpost

**Goal:** `https://deadalus5.github.io/knockout-or-not/…` forwards every visitor to the same page on `knockoutornot.com`, and quietly cleans up the app's old offline helper in their browser.

### Checklist
- [ ] **CLAUDE** — Write the signpost page (`web/pages-redirect/index.html`): forwards to the matching page on the new domain (keeping the path and any `?query`/`#part`), with a visible "KnockoutOrNot has moved to knockoutornot.com" line and link for anyone whose browser blocks scripts.
- [ ] **CLAUDE** — Write the clean-up helper (`web/pages-redirect/sw.js`), served at the exact address the old helper used. When a returning visitor's browser checks for updates, this replaces the old helper, deletes **only this site's** stored files (your other GitHub Pages apps on the same address are left alone), uninstalls itself, and reloads the tab, which then hits the signpost and forwards.
- [ ] **CLAUDE** — Change the GitHub Pages job to publish just these two files (as `index.html`, `404.html`, `sw.js`), only when code is pushed (not on the data-refresh schedule).
- [ ] **CLAUDE** — Two small tidy-ups that are safe now: the page's icon links become absolute (fixes a long-standing missing-icon glitch on directly opened event pages), and the build stops producing the GitHub-Pages-only `404.html` copy.
- [ ] **CLAUDE** — Rehearse locally first: build the old-style site, open it in a test browser so the old helper installs, swap in the signpost files at the same address, reload, and confirm the browser lands on `knockoutornot.com` with the old helper gone.
- [ ] **CLAUDE** — Push, wait at least 10 minutes (GitHub's edge cache), verify.

### How we know it worked
- Opening `https://deadalus5.github.io/knockout-or-not/event/<some-event>?x=1#h` in a fresh browser ends on `https://knockoutornot.com/event/<some-event>?x=1#h`.
- A browser that had the old app cached also ends there after one brief flash.
- The old address's `sw.js` is the clean-up version (its text contains `unregister`).

### How to undo
- Revert the Stage C commit and push; the next run republishes the full site to GitHub Pages. Nothing permanent was cached anywhere.

**Good to know:** anyone who had *installed* the app to a home screen from the old address will be bounced to the new domain in a browser tab when they open it. Installed copies cannot be moved between addresses; they simply re-add the app from `knockoutornot.com`.

---

## 9. Stage D — Paperwork and hardening

### Checklist
- [ ] **CLAUDE** — Update the README, `CLAUDE.md`, `Codebase_Explainer.md`: new address, new hosting description, where the secrets live, the rules below. Historical lines in `Deployment_History.md` stay as they were; a new entry describes this move.
- [ ] **CLAUDE** — Set the repository's "website" field on GitHub to `https://knockoutornot.com`.
- [ ] **CLAUDE** — Update the project notes Claude keeps between sessions.
- [ ] **YOU (optional, recommended, only after everything above is confirmed working)** — Cloudflare → **Manage Domains → knockoutornot.com → Manage → Configuration → Enable DNSSEC**. *(Why: signs the phone-book entries so they cannot be forged. Takes 1–2 days to finish on its own. Never turn it off or move the domain's nameservers without waiting out the period Cloudflare specifies.)*
- [ ] **YOU** — Keep GitHub's email notifications for failed workflow runs on. If the token ever stops working, the publish job turns red, the live site keeps serving the last good version, and the email is how you find out.

---

## 10. After the move — how things run day to day

- **Publishing.** Every push to `main`, and every scheduled data refresh (Sunday 12:00 and 18:00 UTC, Monday 09:00 UTC, plus the Saturday-night fight watcher), runs the same workflow: refresh data → spoiler audit → commit → build → smoke test → upload to Cloudflare. Uploading is the last step and is all-or-nothing: if it fails, the previous version keeps serving.
- **If a publish fails.** The job shows red on GitHub and you get an email. The site stays up on its last good version; new data waits in the repository until the next successful run. The fight watcher retries the whole thing automatically after 30 minutes.
- **Emergency "go back to yesterday" without touching code.** Cloudflare → **Workers & Pages → knockoutornot → Deployments → ⋯ → Rollback** (last 100 versions). Note this also rolls the fight data back to that version until the next refresh.
- **Rolling the token** (if you ever suspect it leaked). Cloudflare → **Manage Account → API Tokens → ⋯ → Roll**, then paste the new value into GitHub exactly as in Stage 0. The old value stops working instantly.

## 11. Rules to remember

1. **Never set a custom domain on the GitHub Pages project.** Doing so would make GitHub redirect the old helper file, and returning visitors' browsers could never clean up.
2. **Never add `main`, `run_worker_first`, or `cache` to `web/wrangler.jsonc`.** Any of them turns free, unlimited file serving into metered requests with a daily cap.
3. **The workflow file is the source of truth for the Worker's domain.** Domains added by hand in the Cloudflare dashboard are removed on the next publish.
4. **Deleting a custom domain leaves its certificate behind;** remove it by hand under SSL/TLS → Edge Certificates if you ever tear things down.
5. **A Cloudflare rollback rolls the data back too**, until the next refresh runs.
6. **Never put a token in a file in this project.** The `.gitignore` guards against accidents, but the rule is the real protection.

## 12. Later, optional

- `robots.txt` and a sitemap: on Cloudflare, directly opened event pages now return a proper "OK" status, so search engines can index them if you want that.
- HSTS (a browser setting that remembers "always HTTPS"), starting with a short duration.
- Mention the new domain in the data pipeline's User-Agent string (two identical copies must change together: `pipeline/src/config.ts` and `.github/workflows/watch-events.yml`).
- A Content-Security-Policy header.

## 13. Status log

- **2026-09-02** — Plan researched (three research passes, seven independent fact-checks against Cloudflare/GitHub documentation and the publishing tool's source), reviewed and approved. Stage 0 started: `.gitignore` extended, change log added to git, GitHub environment `cloudflare` created with a `main`-only rule. Waiting on: Account ID, Zone ID, token in GitHub secrets.

## Appendix — Why this route and not another

- **Keep GitHub Pages, just point the domain at it.** Smallest change and zero new credentials, but no Cloudflare hosting, dashboard, or analytics, and Cloudflare's protective proxy cannot sit in front of GitHub Pages without certificate headaches. Ruled out by your choice of Cloudflare hosting.
- **Cloudflare Pages.** Cloudflare itself now says new projects should use Workers; Pages is maintained but not developed.
- **Let Cloudflare build the site from the repository.** Removes the token from GitHub, but splits "why didn't it publish?" across two dashboards and rebuilds on every data commit. Not worth it for a one-person project.
- **Chosen: Cloudflare Workers static assets, published by the existing GitHub workflow.** One extra job, one limited token, free unlimited serving, instant rollbacks, and every stage reversible.
