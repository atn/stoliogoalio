// ─────────────────────────────────────────────────────────────────────────
//  EA SPORTS FC 26 — Pro Clubs API client (server-side only)
//  All data is fetched LIVE at request time. Nothing here is hardcoded.
//  The EA endpoints sit behind Akamai + CORS, so every call must run on the
//  server with a full browser-like header set (verified working).
// ─────────────────────────────────────────────────────────────────────────

export const CLUB = {
  id: process.env.NEXT_PUBLIC_CLUB_ID || '8623640',
  platform: process.env.NEXT_PUBLIC_PLATFORM || 'common-gen5',
  name: process.env.NEXT_PUBLIC_CLUB_NAME || 'Stolio Goalio',
};

const BASE = 'https://proclubs.ea.com/api/fc';

// How long a fetched payload may be reused before we hit EA again (seconds).
// Small enough to feel live, large enough to survive a room full of friends
// hammering refresh without EA rate-limiting us.
const REVALIDATE = 45;

function headers(): HeadersInit {
  return {
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
}

async function eaGet<T>(
  path: string,
  params: Record<string, string | number>,
  fresh = false,
): Promise<T | null> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${BASE}/${path}?${qs}`;
  try {
    const res = await fetch(url, {
      headers: headers(),
      ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE } }),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trimStart().startsWith('<')) return null; // Akamai/HTML error page
    return deepFixEncoding(JSON.parse(text)) as T;
  } catch {
    return null;
  }
}

// EA double-encodes UTF-8 (names arrive as mojibake like "M\u00c3\u00a3ssa").
// Repair any string showing the telltale \u00c3/\u00c2 lead bytes.
function fixStr(s: string): string {
  if (!s.includes('\u00c3') && !s.includes('\u00c2')) return s;
  try {
    const repaired = Buffer.from(s, 'latin1').toString('utf8');
    // A genuine repair always shrinks the string and never yields U+FFFD.
    return repaired.includes('\uFFFD') || repaired.length >= s.length ? s : repaired;
  } catch {
    return s;
  }
}

function deepFixEncoding<T>(v: T): T {
  if (typeof v === 'string') return fixStr(v) as T;
  if (Array.isArray(v)) return v.map(deepFixEncoding) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = deepFixEncoding(val);
    return out as T;
  }
  return v;
}

// ── Types (loose — EA sends everything as strings) ────────────────────────
export interface CustomKit {
  stadName?: string;
  crestAssetId?: string;
  kitColor1?: string;
  kitColor2?: string;
  kitColor3?: string;
}
export interface ClubInfo {
  name: string;
  clubId: number;
  customKit?: CustomKit;
}
export interface SearchRow {
  clubId: string;
  wins: string;
  losses: string;
  ties: string;
  gamesPlayed: string;
  goals: string;
  goalsAgainst: string;
  cleanSheets: string;
  points: string;
  bestDivision: string;
  promotions: string;
  relegations: string;
  clubInfo: ClubInfo;
  clubName: string;
  currentDivision: string;
}
export interface OverallRow {
  clubId: string;
  gamesPlayed: string;
  wins: string;
  losses: string;
  ties: string;
  goals: string;
  goalsAgainst: string;
  skillRating: string;
  wstreak: string;
  unbeatenstreak: string;
  promotions: string;
  relegations: string;
  leagueAppearances: string;
}
export interface Member {
  name: string;
  gamesPlayed: string;
  winRate: string;
  goals: string;
  assists: string;
  cleanSheetsDef: string;
  cleanSheetsGK: string;
  shotSuccessRate: string;
  passesMade: string;
  passSuccessRate: string;
  ratingAve: string;
  tacklesMade: string;
  tackleSuccessRate: string;
  proName: string;
  proPos: string;
  proHeight: string;
  proOverall: string;
  manOfTheMatch: string;
  redCards: string;
  favoritePosition: string;
  [k: string]: string; // prevGoals0..10, etc.
}
export interface MatchClub {
  goals: string;
  goalsAgainst: string;
  result: string;
  score: string;
  details: ClubInfo;
}
export interface Match {
  matchId: string;
  timestamp: number;
  timeAgo?: { number: number; unit: string };
  clubs: Record<string, MatchClub>;
}

// ── Snapshot source ─────────────────────────────────────────────────────
// EA/Akamai blocks datacenter IPs, so hosted deploys can't call EA directly.
// When SNAPSHOT_URL is set, a GitHub Action fetches EA from a trusted IP and
// publishes snapshot.json; we read that here. With no URL set (local dev) we
// fall back to hitting EA live.
export interface Snapshot {
  fetchedAt: number;
  clubRow: SearchRow | null;
  overall: OverallRow | null;
  members: Member[];
  league: Match[];
  playoff: Match[];
}
const SNAPSHOT_URL = process.env.NEXT_PUBLIC_SNAPSHOT_URL || '';

async function loadSnapshot(fresh = false): Promise<Snapshot | null> {
  if (!SNAPSHOT_URL) return null;
  try {
    const res = await fetch(SNAPSHOT_URL, {
      ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE } }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Snapshot;
  } catch {
    return null;
  }
}

export async function searchClub(name: string): Promise<SearchRow[]> {
  const r = await eaGet<SearchRow[]>('allTimeLeaderboard/search', {
    platform: CLUB.platform,
    clubName: name,
  });
  return r ?? [];
}

export async function getClubRow(): Promise<SearchRow | null> {
  const snap = await loadSnapshot();
  if (snap) return snap.clubRow;
  const rows = await searchClub(CLUB.name);
  if (rows.length) {
    const exact = rows.find((r) => String(r.clubId) === String(CLUB.id));
    return exact ?? rows[0];
  }
  return null;
}

export async function getOverall(): Promise<OverallRow | null> {
  const snap = await loadSnapshot();
  if (snap) return snap.overall;
  const r = await eaGet<OverallRow[]>('clubs/overallStats', {
    platform: CLUB.platform,
    clubIds: CLUB.id,
  });
  return r && r.length ? r[0] : null;
}

export async function getMembers(): Promise<Member[]> {
  const snap = await loadSnapshot();
  if (snap) return snap.members;
  const r = await eaGet<{ members: Member[] }>('members/stats', {
    platform: CLUB.platform,
    clubId: CLUB.id,
  });
  return r?.members ?? [];
}

export async function getMatches(
  type: 'leagueMatch' | 'playoffMatch' = 'leagueMatch',
  count = 20,
  fresh = false,
): Promise<Match[]> {
  const snap = await loadSnapshot(fresh);
  if (snap) {
    return (type === 'leagueMatch' ? snap.league : snap.playoff).slice(0, count);
  }
  const r = await eaGet<Match[]>(
    'clubs/matches',
    {
      platform: CLUB.platform,
      clubIds: CLUB.id,
      matchType: type,
      maxResultCount: count,
    },
    fresh,
  );
  return r ?? [];
}

// Freshest matches for the live match center.
export async function getLiveSnapshot() {
  const snap = await loadSnapshot(true);
  if (snap) {
    const all = [...snap.league, ...snap.playoff].sort((a, b) => b.timestamp - a.timestamp);
    return { matches: all.slice(0, 5), fetchedAt: snap.fetchedAt };
  }
  const [league, playoff] = await Promise.all([
    getMatches('leagueMatch', 5, true),
    getMatches('playoffMatch', 5, true),
  ]);
  const all = [...league, ...playoff].sort((a, b) => b.timestamp - a.timestamp);
  return { matches: all.slice(0, 5), fetchedAt: Date.now() };
}

// Merge league + playoff matches, newest first — the true recent form.
export async function getRecentMatches(count = 12): Promise<Match[]> {
  const snap = await loadSnapshot();
  if (snap) {
    return [...snap.league, ...snap.playoff]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
  const [league, playoff] = await Promise.all([
    getMatches('leagueMatch', count),
    getMatches('playoffMatch', count),
  ]);
  return [...league, ...playoff]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count);
}

// ── Derived helpers (pure) ────────────────────────────────────────────────
export type Res = 'W' | 'L' | 'D';

export function resultFor(m: Match, clubId: string): Res | null {
  const c = m.clubs[clubId];
  if (!c) return null;
  const gf = Number(c.goals);
  const ga = Number(c.goalsAgainst);
  if (gf > ga) return 'W';
  if (gf < ga) return 'L';
  return 'D';
}

export function opponentOf(m: Match, clubId: string): MatchClub | null {
  const id = Object.keys(m.clubs).find((k) => k !== clubId);
  return id ? m.clubs[id] : null;
}

// EA proPos index → readable position label (verified: 14=CM, 5=CB, 25=ST).
const POS: Record<string, string> = {
  '0': 'GK', '1': 'SW', '2': 'RWB', '3': 'RB', '4': 'RCB', '5': 'CB', '6': 'LCB',
  '7': 'LB', '8': 'LWB', '9': 'RDM', '10': 'CDM', '11': 'LDM', '12': 'RM',
  '13': 'RCM', '14': 'CM', '15': 'LCM', '16': 'LM', '17': 'RAM', '18': 'CAM',
  '19': 'LAM', '20': 'RF', '21': 'CF', '22': 'LF', '23': 'RW', '24': 'RS',
  '25': 'ST', '26': 'LS', '27': 'LW',
};
export function posLabel(proPos: string): string {
  return POS[proPos] ?? (proPos ? '—' : '—');
}

// EA sends colours as 24-bit decimal ints. Convert to CSS hex.
export function eaColor(dec?: string | number, fallback = '#39ff88'): string {
  if (dec === undefined || dec === null || dec === '' || dec === '-1') return fallback;
  const n = Number(dec);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

// last-10 goals-per-match series for a player → sparkline data
export function prevGoalsSeries(m: Member): number[] {
  const out: number[] = [];
  for (let i = 10; i >= 1; i--) {
    const v = m[`prevGoals${i}`];
    if (v !== undefined) out.push(Number(v) || 0);
  }
  return out;
}

export function num(v: string | number | undefined, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Shape a member into the data a FUT-style card needs.
export function toFut(m: Member) {
  return {
    name: m.name,
    proName: m.proName || m.name,
    ovr: num(m.proOverall),
    pos: posLabel(m.proPos),
    rating: m.ratingAve || '—',
    stats: [
      { label: 'GLS', value: num(m.goals) },
      { label: 'PAS', value: num(m.passSuccessRate) },
      { label: 'AST', value: num(m.assists) },
      { label: 'SHO', value: num(m.shotSuccessRate) },
      { label: 'APP', value: num(m.gamesPlayed) },
      { label: 'DEF', value: num(m.tackleSuccessRate) },
    ],
  };
}
