import { NextRequest, NextResponse } from "next/server";
import { getDb, esc, saveDb } from "@/lib/db";
import { seedDemoData } from "@/lib/seed";
import { startPtaSync, stopPtaSync } from "@/lib/pta-sync";
import { computeStatus } from "@/lib/competition-status";

export async function GET() {
  const db = await getDb();

  const versionResult = db.exec("PRAGMA user_version");
  const seeded = versionResult.length > 0 ? Number(versionResult[0].values[0][0]) : 0;
  if (!seeded) {
    const demoId = seedDemoData(db);
    db.run("PRAGMA user_version = 1");
    saveDb();
    console.log(`Demo competition created (id=${demoId})`);
  }

  const compRows = db.exec(`
    SELECT c.*, COUNT(DISTINCT t.id) as team_count, COUNT(DISTINCT m.id) as member_count
    FROM competitions c
    LEFT JOIN teams t ON t.competition_id = c.id
    LEFT JOIN members m ON m.team_id = t.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);

  if (compRows.length === 0) {
    return NextResponse.json([]);
  }

  const rows = compRows[0].values.map((v) => ({
    id: v[0],
    name: v[1],
    created_at: v[2],
    status: computeStatus(
      v[4] as string | null,
      v[5] as number | null,
      v[3] as string
    ),
    start_time: v[4],
    duration_minutes: v[5],
    pta_contest_id: v[7],
    team_count: v[8],
    member_count: v[9],
  }));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    teams: teamData,
    start_time,
    duration_minutes,
    access_cookie,
    pta_contest_id,
  } = body as {
    name: string;
    teams: { name: string; members: string[] }[];
    start_time?: string;
    duration_minutes?: number;
    access_cookie?: string;
    pta_contest_id?: string;
  };

  if (!name || !teamData || teamData.length === 0) {
    return NextResponse.json(
      { error: "比赛名称和队伍信息不能为空" },
      { status: 400 }
    );
  }

  for (const t of teamData) {
    if (!t.name || !t.name.trim()) {
      return NextResponse.json(
        { error: "队伍名称不能为空" },
        { status: 400 }
      );
    }
    if (!t.members || t.members.length === 0) {
      return NextResponse.json(
        { error: `队伍 "${t.name}" 至少需要一名队员` },
        { status: 400 }
      );
    }
    for (const mn of t.members) {
      if (!mn || !mn.trim()) {
        return NextResponse.json(
          { error: `队伍 "${t.name}" 存在空姓名队员` },
          { status: 400 }
        );
      }
    }
  }

  const db = await getDb();
  const now = new Date();
  const startTime = start_time || now.toISOString().slice(0, 19).replace("T", " ");
  const duration = duration_minutes || 180;
  const cookie = access_cookie || "";
  const ptaId = pta_contest_id || "";
  const status =
    start_time && new Date(start_time) > now ? "upcoming" : "active";

  db.run(
    `INSERT INTO competitions (name, status, created_at, start_time, duration_minutes, access_cookie, pta_contest_id) VALUES (${esc(name)}, ${esc(status)}, datetime('now', 'localtime'), ${esc(startTime)}, ${duration}, ${esc(cookie)}, ${esc(ptaId)})`
  );
  const compResult = db.exec("SELECT last_insert_rowid()");
  const compId = Number(compResult[0].values[0][0]);

  for (const team of teamData) {
    db.run(
      `INSERT INTO teams (competition_id, name) VALUES (${compId}, ${esc(team.name)})`
    );
    const teamResult = db.exec("SELECT last_insert_rowid()");
    const teamId = Number(teamResult[0].values[0][0]);

    for (const memberName of team.members) {
      db.run(
        `INSERT INTO members (team_id, name) VALUES (${teamId}, ${esc(memberName)})`
      );
    }
  }

  saveDb();

  if (cookie && ptaId) {
    startPtaSync(compId, 60);
  }

  return NextResponse.json({ id: compId, name, status: "active" }, { status: 201 });
}
