import { getDb, saveDb, esc } from "./db";
import { fetchPtaAllRankings, fetchPtaProblemTypes, transformPtaData } from "./pta-scraper";
import { ALL_MAX_SCORES, PROBLEM_LABELS } from "@/types";

const syncTimers = new Map<number, ReturnType<typeof setInterval>>();
const lastSyncTimes = new Map<number, string>();
const syncInProgress = new Set<number>();

export async function syncOnce(competitionId: number): Promise<number> {
  if (syncInProgress.has(competitionId)) return 0;
  syncInProgress.add(competitionId);

  const db = await getDb();

  const compRows = db.exec(
    `SELECT access_cookie, pta_contest_id FROM competitions WHERE id = ${competitionId}`
  );
  if (compRows.length === 0 || compRows[0].values.length === 0) return 0;

  const comp = compRows[0].values[0];
  const cookie = (comp[0] as string) || "";
  const ptaContestId = (comp[1] as string) || "";

  if (!cookie || !ptaContestId) return 0;

  try {
    const problems = await fetchPtaProblemTypes(ptaContestId, cookie);
    const rankings = await fetchPtaAllRankings(ptaContestId, cookie);
    const players = transformPtaData(problems, rankings);

    const memberRows = db.exec(`
      SELECT m.id, m.name FROM members m
      JOIN teams t ON t.id = m.team_id
      WHERE t.competition_id = ${competitionId}
    `);

    const nameToId = new Map<string, number>();
    if (memberRows.length > 0) {
      for (const row of memberRows[0].values) {
        nameToId.set(row[1] as string, row[0] as number);
      }
    }

    const labelToMaxScore: Record<string, number> = {};
    for (let i = 0; i < problems.length && i < PROBLEM_LABELS.length; i++) {
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
        const maxScore = labelToMaxScore[label] || 0;
        const acceptTime = player.acceptTime[label] || 0;
        db.run(
          `INSERT OR REPLACE INTO scores (member_id, problem_label, score, max_score, accept_time, updated_at)
           VALUES (${memberId}, ${esc(label)}, ${Math.round(score) || 0}, ${maxScore}, ${acceptTime}, datetime('now', 'localtime'))`
        );
      }
    }

    saveDb();
    return matchedCount;
  } catch (err) {
    console.error(`PTA sync failed for competition ${competitionId}:`, err);
    return 0;
  } finally {
    syncInProgress.delete(competitionId);
  }
}

export function startPtaSync(competitionId: number, intervalSec = 60): void {
  if (syncTimers.has(competitionId)) {
    return;
  }

  syncOnce(competitionId).then((count) => {
    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    lastSyncTimes.set(competitionId, now);
  });

  const timer = setInterval(async () => {
    try {
      const count = await syncOnce(competitionId);
      const now = new Date().toLocaleString("zh-CN", { hour12: false });
      lastSyncTimes.set(competitionId, now);
    } catch (err) {
      console.error(`PTA sync error for ${competitionId}:`, err);
    }
  }, intervalSec * 1000);

  syncTimers.set(competitionId, timer);
}

export function stopPtaSync(competitionId: number): void {
  const timer = syncTimers.get(competitionId);
  if (timer) {
    clearInterval(timer);
    syncTimers.delete(competitionId);
    lastSyncTimes.delete(competitionId);
  }
}

export function getPtaSyncStatus(
  competitionId: number
): { running: boolean; lastSyncTime: string | null } {
  return {
    running: syncTimers.has(competitionId),
    lastSyncTime: lastSyncTimes.get(competitionId) || null,
  };
}

export function stopAllPtaSync(): void {
  for (const [id] of syncTimers) {
    stopPtaSync(id);
  }
}
