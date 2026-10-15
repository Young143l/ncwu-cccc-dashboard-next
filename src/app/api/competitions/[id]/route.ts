import { NextRequest, NextResponse } from "next/server";
import { getDb, esc, saveDb } from "@/lib/db";
import { stopPtaSync, startPtaSync } from "@/lib/pta-sync";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";
import { computeStatus } from "@/lib/competition-status";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  const compRows = db.exec(
    `SELECT id, name, created_at, status, start_time, duration_minutes, access_cookie, pta_contest_id, end_time
     FROM competitions WHERE id = ${compId}`
  );
  if (compRows.length === 0 || compRows[0].values.length === 0) {
    return NextResponse.json({ error: "比赛不存在" }, { status: 404 });
  }
  const comp = compRows[0].values[0];

  const teamRows = db.exec(`SELECT * FROM teams WHERE competition_id = ${compId}`);

  const teams: Array<{
    id: number;
    name: string;
    members: Array<{
      id: number;
      name: string;
      scores: Array<{
        problem_label: string;
        score: number;
        max_score: number;
        accept_time: number | null;
      }>;
    }>;
  }> = [];

  if (teamRows.length > 0) {
    for (const t of teamRows[0].values) {
      const teamId = t[0] as number;
      const memberRows = db.exec(`SELECT * FROM members WHERE team_id = ${teamId}`);

      const members: Array<{
        id: number;
        name: string;
        scores: Array<{
          problem_label: string;
          score: number;
          max_score: number;
          accept_time: number | null;
        }>;
      }> = [];

      if (memberRows.length > 0) {
        for (const m of memberRows[0].values) {
          const memberId = m[0] as number;
          const scoreRows = db.exec(
            `SELECT problem_label, score, max_score, accept_time FROM scores WHERE member_id = ${memberId}`
          );
          const existingScores =
            scoreRows.length > 0
              ? scoreRows[0].values.map((s) => ({
                  problem_label: s[0] as string,
                  score: s[1] as number,
                  max_score: s[2] as number,
                  accept_time: s[3] as number | null,
                }))
              : [];

          const existingMap = new Map(
            existingScores.map((s) => [s.problem_label, s])
          );
          const scores = PROBLEM_LABELS.map((label) => {
            const existing = existingMap.get(label);
            return existing || {
              problem_label: label,
              score: 0,
              max_score: ALL_MAX_SCORES[PROBLEM_LABELS.indexOf(label)] || 0,
              accept_time: null,
            };
          });

          members.push({ id: memberId, name: m[2] as string, scores });
        }
      }

      teams.push({ id: teamId, name: t[2] as string, members });
    }
  }

  return NextResponse.json({
    id: comp[0],
    name: comp[1],
    created_at: comp[2],
    status: computeStatus(
      comp[4] as string | null,
      comp[8] as string | null,
      comp[5] as number | null,
      comp[3] as string
    ),
    start_time: comp[4],
    duration_minutes: comp[5],
    end_time: comp[8],
    pta_contest_id: comp[7],
    has_cookie: Boolean(comp[6]),
    teams,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const body = await req.json();
  const {
    status,
    teams,
    name,
    start_time,
    end_time,
    duration_minutes,
    access_cookie,
    pta_contest_id,
  } = body as {
    status?: string;
    teams?: Array<{
      id: number;
      name: string;
      members: Array<{ id: number; name: string }>;
    }>;
    name?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    access_cookie?: string;
    pta_contest_id?: string;
  };

  const db = await getDb();

  if (status) {
    if (!["active", "finished", "upcoming"].includes(status)) {
      return NextResponse.json({ error: "无效的状态" }, { status: 400 });
    }
  }

  const sets: string[] = [];
  if (status) sets.push(`status = ${esc(status)}`);
  if (typeof name === "string" && name.trim()) {
    sets.push(`name = ${esc(name.trim())}`);
  }
  if (typeof start_time === "string" && start_time.trim()) {
    sets.push(`start_time = ${esc(start_time.trim())}`);
  }
  if (typeof end_time === "string") {
    // 允许传空字符串清空结束时间（清空后回退到 start_time + duration 判断）
    sets.push(`end_time = ${end_time.trim() ? esc(end_time.trim()) : "NULL"}`);
  }
  if (typeof duration_minutes === "number" && duration_minutes > 0) {
    sets.push(`duration_minutes = ${Math.round(duration_minutes)}`);
  }
  if (typeof access_cookie === "string") {
    sets.push(`access_cookie = ${esc(access_cookie.trim())}`);
  }
  if (typeof pta_contest_id === "string") {
    sets.push(`pta_contest_id = ${esc(pta_contest_id.trim())}`);
  }

  if (sets.length > 0) {
    db.run(`UPDATE competitions SET ${sets.join(", ")} WHERE id = ${compId}`);
  }

  // PTA 配置变更后，按新配置重启自动同步定时器
  const ptaConfigChanged =
    typeof access_cookie === "string" || typeof pta_contest_id === "string";

  if (teams) {
    const existingRows = db.exec(`SELECT id FROM teams WHERE competition_id = ${compId}`);
    const existingTeamIds = existingRows.length > 0
      ? new Set(existingRows[0].values.map((r) => r[0] as number))
      : new Set<number>();
    const incomingTeamIds = new Set<number>();

    for (const team of teams) {
      if (team.id > 0) {
        incomingTeamIds.add(team.id);
        db.run(`UPDATE teams SET name = ${esc(team.name)} WHERE id = ${team.id}`);

        const memberRows = db.exec(`SELECT id, name FROM members WHERE team_id = ${team.id}`);
        const existingMembers = memberRows.length > 0
          ? memberRows[0].values.map((r) => ({ id: r[0] as number, name: r[1] as string }))
          : [];
        const incomingNames = team.members.map((m) => m.name.trim());

        // Count incoming names to handle duplicates correctly
        const incomingCounts = new Map<string, number>();
        for (const n of incomingNames) {
          incomingCounts.set(n, (incomingCounts.get(n) || 0) + 1);
        }

        // Delete members not in incoming list (count-aware)
        const existingCounts = new Map<string, number>();
        for (const em of existingMembers) {
          existingCounts.set(em.name, (existingCounts.get(em.name) || 0) + 1);
        }
        for (const em of existingMembers) {
          const inc = incomingCounts.get(em.name) || 0;
          const exc = existingCounts.get(em.name) || 0;
          if (inc < exc) {
            db.run(`DELETE FROM members WHERE id = ${em.id}`);
            existingCounts.set(em.name, exc - 1);
          }
        }

        // Insert new members
        const existingNameSet = new Set(existingMembers.map((m) => m.name));
        for (const name of incomingNames) {
          if (!existingNameSet.has(name)) {
            db.run(`INSERT INTO members (team_id, name) VALUES (${team.id}, ${esc(name)})`);
            const newMemberId = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
            for (let i = 0; i < PROBLEM_LABELS.length; i++) {
              db.run(
                `INSERT INTO scores (member_id, problem_label, score, max_score) VALUES (${newMemberId}, ${esc(PROBLEM_LABELS[i])}, 0, ${ALL_MAX_SCORES[i]})`
              );
            }
            existingNameSet.add(name);
          }
        }
      } else {
        db.run(`INSERT INTO teams (competition_id, name) VALUES (${compId}, ${esc(team.name)})`);
        const newTeamId = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);

        for (const m of team.members) {
          const memberName = m.name.trim();
          if (!memberName) continue;
          db.run(`INSERT INTO members (team_id, name) VALUES (${newTeamId}, ${esc(memberName)})`);
          const newMemberId = Number(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
          for (let i = 0; i < PROBLEM_LABELS.length; i++) {
            db.run(
              `INSERT INTO scores (member_id, problem_label, score, max_score) VALUES (${newMemberId}, ${esc(PROBLEM_LABELS[i])}, 0, ${ALL_MAX_SCORES[i]})`
            );
          }
        }
      }
    }

    for (const existingId of existingTeamIds) {
      if (!incomingTeamIds.has(existingId)) {
        db.run(`DELETE FROM teams WHERE id = ${existingId}`);
      }
    }
  }

  saveDb();

  if (ptaConfigChanged) {
    stopPtaSync(compId);
    const configRows = db.exec(
      `SELECT access_cookie, pta_contest_id FROM competitions WHERE id = ${compId}`
    );
    const config =
      configRows.length > 0 && configRows[0].values.length > 0
        ? configRows[0].values[0]
        : null;
    const cookie = ((config?.[0] as string) || "").trim();
    const ptaContestId = ((config?.[1] as string) || "").trim();
    if (cookie && ptaContestId) {
      startPtaSync(compId, 60);
    }
  }

  return NextResponse.json({ id: compId });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);
  const db = await getDb();

  stopPtaSync(compId);
  db.run(`DELETE FROM competitions WHERE id = ${compId}`);
  saveDb();

  return NextResponse.json({ success: true });
}
