import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";

// Next 会为 instrumentation 与各路由分别打包，模块级变量不共享，
// 必须把连接挂到 globalThis，否则会出现两个互不相干的内存库并互相覆盖落盘文件。
const globalForDb = globalThis as unknown as {
  __dashboardDb?: Database | null;
  __dashboardDbPath?: string | null;
};

export function saveDb(): void {
  const db = globalForDb.__dashboardDb;
  const dbPath = globalForDb.__dashboardDbPath;
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

export async function getDb(): Promise<Database> {
  if (globalForDb.__dashboardDb) return globalForDb.__dashboardDb;

  const SQL = await initSqlJs();

  const dbPath = path.join(process.cwd(), "data", "dashboard.db");
  globalForDb.__dashboardDbPath = dbPath;

  let db: Database;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  globalForDb.__dashboardDb = db;

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS competitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'finished', 'upcoming')),
      start_time TEXT,
      duration_minutes INTEGER DEFAULT 180,
      access_cookie TEXT DEFAULT '',
      pta_contest_id TEXT DEFAULT '',
      end_time TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      problem_label TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      max_score INTEGER NOT NULL DEFAULT 0,
      accept_time INTEGER DEFAULT NULL,
      valid_submit_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(member_id, problem_label)
    )
  `);

  // 老库文件补列：end_time 是后续新增的字段，ALTER TABLE 会追加到表尾，
  // 因此 CREATE TABLE 里也要把它放在最后一列，保证新旧库列顺序一致。
  const compCols = db.exec("PRAGMA table_info(competitions)");
  const hasEndTime =
    compCols.length > 0 &&
    compCols[0].values.some((row) => row[1] === "end_time");
  if (!hasEndTime) {
    db.run("ALTER TABLE competitions ADD COLUMN end_time TEXT");
  }

  saveDb();

  return db;
}

export function esc(v: string | number): string {
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}
