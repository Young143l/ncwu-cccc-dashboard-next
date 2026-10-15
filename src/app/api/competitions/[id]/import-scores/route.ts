import { NextRequest, NextResponse } from "next/server";
import { getDb, esc, saveDb } from "@/lib/db";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  const players: Array<{
    name: string;
    score: Record<string, number>;
    acceptTime?: Record<string, number>;
  }> = await req.json();

  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json(
      { error: "数据格式错误，需要 [{name, score}]" },
      { status: 400 }
    );
  }

  const memberRows = db.exec(`
    SELECT m.id, m.name FROM members m
    JOIN teams t ON t.id = m.team_id
    WHERE t.competition_id = ${compId}
  `);

  const nameToId = new Map<string, number>();
  if (memberRows.length > 0) {
    for (const row of memberRows[0].values) {
      nameToId.set(row[1] as string, row[0] as number);
    }
  }

  const labelToMaxScore: Record<string, number> = {};
  for (let i = 0; i < PROBLEM_LABELS.length; i++) {
    labelToMaxScore[PROBLEM_LABELS[i]] = ALL_MAX_SCORES[i];
  }

  let matchedCount = 0;
  const unmatchedPlayers: string[] = [];

  for (const player of players) {
    let memberId = nameToId.get(player.name);
    if (!memberId) {
      for (const [dbName, dbId] of nameToId) {
        if (dbName.includes(player.name) || player.name.includes(dbName)) {
          memberId = dbId;
          break;
        }
      }
    }
    if (!memberId) {
      unmatchedPlayers.push(player.name);
      continue;
    }
    matchedCount++;

    for (const [label, score] of Object.entries(player.score)) {
      if (!PROBLEM_LABELS.includes(label)) continue;
      const maxScore = labelToMaxScore[label] || 0;
      const acceptTime = player.acceptTime?.[label] || 0;
      db.run(
        `INSERT OR REPLACE INTO scores (member_id, problem_label, score, max_score, accept_time, updated_at)
         VALUES (${memberId}, ${esc(label)}, ${Math.round(score) || 0}, ${maxScore}, ${acceptTime}, datetime('now', 'localtime'))`
      );
    }
  }

  saveDb();

  return NextResponse.json({
    success: true,
    matchedCount,
    unmatchedCount: unmatchedPlayers.length,
    unmatchedPlayers:
      unmatchedPlayers.length > 0 ? unmatchedPlayers : undefined,
  });
}
