import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";

let db: Database | null = null;
let dbPath: string | null = null;

export function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  dbPath = path.join(process.cwd(), "data", "dashboard.db");

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
      pta_contest_id TEXT DEFAULT ''
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

  saveDb();

  return db;
}

export function esc(v: string | number): string {
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}
