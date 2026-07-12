# Making the live data work on stoliogoalio.com

## Why the site said "EA wire is down"

EA's Pro Clubs API sits behind Akamai, which **blocks shared datacenter IPs**.
Cloudflare Workers run on exactly those IPs, so EA denies every request from
your deploy — no matter the headers. Your Mac works because it has a
*residential* IP that Akamai trusts.

The fix: don't call EA from Cloudflare. A **GitHub Action** (which runs on a
trusted IP) fetches EA every 5 minutes and commits the result to a `data`
branch. Your site reads that file from GitHub's raw CDN, which **is** reachable
from Cloudflare and is CORS-open. No paid proxy, no Cloudflare KV, no new
account — it uses the GitHub repo Cloudflare already deploys from.

```
GitHub Action (trusted IP)  ──fetch──▶  EA Pro Clubs API
        │
        └─commit──▶  data branch/snapshot.json  ──raw CDN──▶  your site
```

## One-time setup (5 minutes)

1. **Push this repo to GitHub** (it already is, if Cloudflare deploys from it).

2. **Make the repo public.** The raw-file URL needs no token only if the repo
   is public. (A friends' stats site has nothing secret in it.)

3. **Enable Actions write access:** repo → Settings → Actions → General →
   *Workflow permissions* → "Read and write permissions" → Save.
   Then run the workflow once by hand: repo → Actions → "EA snapshot" → *Run
   workflow*. It creates the `data` branch with the first `snapshot.json`.
   After that it runs itself every 5 minutes.

4. **Point the site at the snapshot.** In Cloudflare → your project → Settings
   → Environment variables, add (Production **and** Preview):

   ```
   NEXT_PUBLIC_SNAPSHOT_URL = https://raw.githubusercontent.com/atn/stoliogoalio/data/snapshot.json
   ```

   Redeploy. Done — the site now reads live data that refreshes every 5 minutes.

## If the Action itself gets an "Access Denied"

GitHub's runner IPs are usually fine, but if Akamai blocks them too, run the
fetcher from your Mac instead — its residential IP always works. It pushes to
the same `data` branch, so **nothing else changes**:

```bash
# one-off test
node scripts/snapshot.mjs > /tmp/snapshot.json

# every 10 min via cron (crontab -e). Needs the GitHub CLI `gh` authed once.
*/10 * * * * cd /Users/austin/Desktop/StoleoGoalio && node scripts/snapshot.mjs > /tmp/sg.json && \
  gh api -X PUT repos/atn/stoliogoalio/contents/snapshot.json \
    -f message="snapshot" -f branch=data \
    -f content="$(base64 -i /tmp/sg.json)" \
    -f sha="$(gh api repos/atn/stoliogoalio/contents/snapshot.json?ref=data --jq .sha 2>/dev/null)"
```

(Keep the Action enabled as the primary; the Mac cron is only a fallback.)

## Freshness

The site caches each snapshot read for 45s and the Action refreshes every 5
min, so results appear within a few minutes of a game finishing — the "JUST IN"
tag lights up automatically. Want it tighter? Lower the cron in
`.github/workflows/snapshot.yml` (GitHub's floor is ~1 min, though scheduled
runs can queue under load).
