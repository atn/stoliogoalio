'use client';

import { useEffect, useState } from 'react';

interface LiveRow {
  matchId: string;
  timestamp: number;
  result: 'W' | 'L' | 'D';
  goals: number;
  against: number;
  opponent: string;
  stadium: string | null;
}

const POLL_MS = 45_000;
const JUST_IN_WINDOW = 30 * 60;

function ago(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'moments ago';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr${h === 1 ? '' : 's'} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

// The latest score, set enormous. Polls EA every 45s so a game that just
// ended lands on the page without a refresh.
export default function LiveCenter({ clubName }: { clubName: string }) {
  const [rows, setRows] = useState<LiveRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setRows(j.rows);
      } catch {
        /* keep the last score up */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const latest = rows?.[0];
  const justIn = latest && Date.now() / 1000 - latest.timestamp < JUST_IN_WINDOW;

  return (
    <div className="latest">
      <div className="status">
        {justIn && <span className="justin">Full time · just in</span>}
        <span className="mono acc">
          {latest
            ? `${latest.result === 'W' ? 'Win' : latest.result === 'L' ? 'Loss' : 'Draw'} · ${ago(latest.timestamp)}${latest.stadium ? ` · ${latest.stadium}` : ''}`
            : rows
              ? 'Watching the wire for kickoff'
              : 'Checking the wire'}
        </span>
      </div>

      {latest && (
        <div className="scoreline">
          <div className="side">
            <div className="club us">{clubName}</div>
          </div>
          <div className="digits">
            <span>{latest.goals}</span>
            <span className="sep">/</span>
            <span>{latest.against}</span>
          </div>
          <div className="side them">
            <div className="club">{latest.opponent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
