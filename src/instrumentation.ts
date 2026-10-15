export async function register() {
  // 只在 Node.js 运行时、非构建阶段执行
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { getDb } = await import("@/lib/db");
  const { startPtaSync } = await import("@/lib/pta-sync");
  const { computeStatus } = await import("@/lib/competition-status");

  try {
    const db = await getDb();
    const rows = db.exec(
      "SELECT id, access_cookie, pta_contest_id, start_time, duration_minutes, status, end_time FROM competitions"
    );
    if (rows.length === 0) return;

    let restored = 0;
    for (const row of rows[0].values) {
      const id = Number(row[0]);
      const cookie = String(row[1] ?? "").trim();
      const ptaContestId = String(row[2] ?? "").trim();
      if (!cookie || !ptaContestId) continue;

      const status = computeStatus(
        row[3] as string | null,
        row[6] as string | null,
        row[4] as number | null,
        String(row[5] ?? "")
      );
      if (status !== "active") continue;

      startPtaSync(id, 60);
      restored++;
    }

    if (restored > 0) {
      console.log(`[pta-sync] 已恢复 ${restored} 场比赛的自动同步`);
    }
  } catch (err) {
    console.error("[pta-sync] 启动恢复自动同步失败:", err);
  }
}
