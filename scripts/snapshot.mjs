#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Snapshot fetcher — runs somewhere with a trusted (non-datacenter) IP,
//  pulls every EA endpoint once, and writes a single snapshot.json.
//  EA/Akamai blocks Cloudflare's datacenter IPs, so the site can't call EA
//  directly; instead this runs on GitHub Actions (or your Mac) and the site
//  reads the resulting snapshot from a CORS-open GitHub URL.
//
//  Usage:  node scripts/snapshot.mjs > snapshot.json
// ─────────────────────────────────────────────────────────────────────────

const CLUB_ID = process.env.CLUB_ID || '8623640';
const PLATFORM = process.env.PLATFORM || 'common-gen5';
const CLUB_NAME = process.env.CLUB_NAME || 'Stolio Goalio';
const BASE = 'https://proclubs.ea.com/api/fc';

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.ea.com/',
  origin: 'https://www.ea.com',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

// EA double-encodes UTF-8; repair strings that show the tell-tale bytes.
function fixStr(s) {
  if (typeof s !== 'string' || (!s.includes('Ã') && !s.includes('Â'))) return s;
  try {
    const rep = Buffer.from(s, 'latin1').toString('utf8');
    return rep.includes('�') || rep.length >= s.length ? s : rep;
  } catch {
    return s;
  }
}
function deepFix(v) {
  if (typeof v === 'string') return fixStr(v);
  if (Array.isArray(v)) return v.map(deepFix);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = deepFix(val);
    return o;
  }
  return v;
}

async function get(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/${path}?${qs}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      const text = await res.text();
      if (!res.ok || !text || text.trimStart().startsWith('<')) {
        // Akamai denial or EA error page — retry after a beat
        if (attempt < 2) { await sleep(1500); continue; }
        throw new Error(`EA ${res.status} for ${path} (blocked or empty)`);
      }
      return deepFix(JSON.parse(text));
    } catch (e) {
      if (attempt < 2) { await sleep(1500); continue; }
      throw e;
    }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [searchRes, overall, membersRes, league, playoff] = await Promise.all([
    get('allTimeLeaderboard/search', { platform: PLATFORM, clubName: CLUB_NAME }),
    get('clubs/overallStats', { platform: PLATFORM, clubIds: CLUB_ID }),
    get('members/stats', { platform: PLATFORM, clubId: CLUB_ID }),
    get('clubs/matches', { platform: PLATFORM, clubIds: CLUB_ID, matchType: 'leagueMatch', maxResultCount: 25 }),
    get('clubs/matches', { platform: PLATFORM, clubIds: CLUB_ID, matchType: 'playoffMatch', maxResultCount: 25 }),
  ]);

  const rows = Array.isArray(searchRes) ? searchRes : [];
  const clubRow = rows.find((r) => String(r.clubId) === String(CLUB_ID)) || rows[0] || null;

  const snapshot = {
    fetchedAt: Date.now(),
    clubId: CLUB_ID,
    platform: PLATFORM,
    clubRow,
    overall: Array.isArray(overall) && overall.length ? overall[0] : null,
    members: membersRes?.members ?? [],
    league: Array.isArray(league) ? league : [],
    playoff: Array.isArray(playoff) ? playoff : [],
  };

  process.stdout.write(JSON.stringify(snapshot));
  process.stderr.write(
    `ok · ${snapshot.members.length} pros · ${snapshot.league.length + snapshot.playoff.length} matches · ` +
      `record ${clubRow?.wins}-${clubRow?.losses}-${clubRow?.ties}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`FAILED: ${e.message}\n`);
  process.exit(1);
});
