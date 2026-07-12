import { NextResponse } from 'next/server';
import { getLiveSnapshot, resultFor, opponentOf, CLUB } from '@/lib/ea';

export const dynamic = 'force-dynamic';

// Polled by the client-side match center. Returns the freshest matches EA has.
export async function GET() {
  const snap = await getLiveSnapshot();
  const rows = snap.matches
    .map((m) => {
      const res = resultFor(m, CLUB.id);
      const me = m.clubs[CLUB.id];
      const opp = opponentOf(m, CLUB.id);
      if (!res || !me) return null;
      return {
        matchId: m.matchId,
        timestamp: m.timestamp,
        result: res,
        goals: Number(me.goals),
        against: Number(me.goalsAgainst),
        opponent: opp?.details?.name ?? 'Unknown',
        stadium: opp?.details?.customKit?.stadName ?? null,
      };
    })
    .filter(Boolean);
  return NextResponse.json({ rows, fetchedAt: snap.fetchedAt });
}
