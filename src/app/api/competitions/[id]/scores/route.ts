import { NextRequest, NextResponse } from "next/server";
import { getDb, esc, saveDb } from "@/lib/db";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  const result = db.exec(`
    SELECT s.member_id, s.problem_label, s.score, s.max_score, s.accept_time, s.valid_submit_count
    FROM scores s
    JOIN members m ON m.id = s.member_id
    JOIN teams t ON t.id = m.team_id
    WHERE t.competition_id = ${compId}
  `);

  if (result.length === 0) {
    return NextResponse.json([]);
  }

  const scores = result[0].values.map((v) => ({
    member_id: v[0],
    problem_label: v[1],
    score: v[2],
    max_score: v[3],
    accept_time: v[4],
    valid_submit_count: v[5],
  }));

  return NextResponse.json(scores);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  const body = await req.json();
  const { updates } = body as {
    updates: Array<{
      member_id: number;
      problem_label: string;
      score: number;
    }>;
  };

  if (!updates || updates.length === 0) {
    return NextResponse.json({ error: "更新数据不能为空" }, { status: 400 });
  }

  for (const u of updates) {
    const labelIndex = PROBLEM_LABELS.indexOf(u.problem_label);
    const maxScore = labelIndex >= 0 ? ALL_MAX_SCORES[labelIndex] : 0;
    db.run(
      `INSERT INTO scores (member_id, problem_label, score, max_score, updated_at)
       VALUES (${u.member_id}, ${esc(u.problem_label)}, ${u.score}, ${maxScore}, datetime('now', 'localtime'))
       ON CONFLICT(member_id, problem_label) DO UPDATE SET
         score = excluded.score,
         max_score = excluded.max_score,
         updated_at = excluded.updated_at`
    );
  }

  saveDb();
  return NextResponse.json({ success: true, count: updates.length });
}
