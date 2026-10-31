import { NextRequest, NextResponse } from "next/server";
import { getDb, esc, saveDb } from "@/lib/db";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";
import { matchMember, parseMemberName } from "@/lib/member-name";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  const players: Array<{
    name: string;
    studentNumber?: string | null;
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

  const roster = memberRows.length > 0
    ? memberRows[0].values.map((row) => ({
        id: row[0] as number,
        name: String(row[1] ?? ""),
      }))
    : [];

  const labelToMaxScore: Record<string, number> = {};
  for (let i = 0; i < PROBLEM_LABELS.length; i++) {
    labelToMaxScore[PROBLEM_LABELS[i]] = ALL_MAX_SCORES[i];
  }

  let matchedCount = 0;
  const unmatchedPlayers: string[] = [];

  for (const player of players) {
    // 严格按学号匹配：优先用显式 studentNumber，其次从「学号姓名」里解析
    const parsedName = parseMemberName(player.name);
    const result = matchMember(
      {
        name: parsedName.name,
        studentNumber: player.studentNumber ?? parsedName.studentNumber,
      },
      roster
    );
    if (!result.memberId) {
      unmatchedPlayers.push(player.name);
      continue;
    }
    const memberId = result.memberId;
    matchedCount++;

    for (const [label, score] of Object.entries(player.score)) {
      if (!PROBLEM_LABELS.includes(label)) continue;
      const maxScore = labelToMaxScore[label] || 0;
      const acceptTime = player.acceptTime?.[label] || 0;
      db.run(
        `INSERT INTO scores (member_id, problem_label, score, max_score, accept_time, updated_at)
         VALUES (${memberId}, ${esc(label)}, ${Math.round(score) || 0}, ${maxScore}, ${acceptTime}, datetime('now', 'localtime'))
         ON CONFLICT(member_id, problem_label) DO UPDATE SET
           score = excluded.score,
           max_score = excluded.max_score,
           updated_at = excluded.updated_at`
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
