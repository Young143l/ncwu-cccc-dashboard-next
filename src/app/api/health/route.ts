import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { getBuildInfo } from "@/lib/build-info";
import { getDb } from "@/lib/db";

/** 进程启动时间，用于计算 uptime（模块加载即视为启动） */
const startedAt = Date.now();

/**
 * 健康检查：给 1Panel / 外部监控探活用，同时暴露版本信息，
 * 部署后可直接确认线上跑的是哪个提交。不含任何敏感数据。
 */
export async function GET() {
  const info = getBuildInfo();

  let dbBytes: number | null = null;
  let competitions: number | null = null;
  let dbOk = false;

  try {
    const dbPath = path.join(process.cwd(), "data", "dashboard.db");
    if (fs.existsSync(dbPath)) dbBytes = fs.statSync(dbPath).size;
    const db = await getDb();
    const rows = db.exec("SELECT COUNT(*) FROM competitions");
    competitions = rows.length > 0 ? Number(rows[0].values[0][0]) : 0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      ok: dbOk,
      version: info.version,
      gitSha: info.gitSha,
      gitBranch: info.gitBranch,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      db: { readable: dbOk, bytes: dbBytes, competitions },
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
