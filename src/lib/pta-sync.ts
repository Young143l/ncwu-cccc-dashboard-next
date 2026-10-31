import { getDb, saveDb, esc } from "./db";
import { fetchPtaAllRankings, fetchPtaProblemTypes, transformPtaData } from "./pta-scraper";
import { matchMember, parseMemberName } from "./member-name";
import { ALL_MAX_SCORES, PROBLEM_LABELS } from "@/types";

// 同 db.ts：instrumentation 与路由是两份模块实例，定时器/状态必须宿在 globalThis 上共享，
// 否则会出现「启动恢复的定时器停不下来、UI 再起一个定时器」的双写局面。
interface SyncRegistry {
  timers: Map<number, ReturnType<typeof setInterval>>;
  inProgress: Set<number>;
  states: Map<number, SyncRecord>;
}

const globalForSync = globalThis as unknown as {
  __ptaSyncRegistry?: SyncRegistry;
};

const registry: SyncRegistry = (globalForSync.__ptaSyncRegistry ??= {
  timers: new Map(),
  inProgress: new Set(),
  states: new Map(),
});

const syncTimers = registry.timers;
const syncInProgress = registry.inProgress;
const syncStates = registry.states;

export interface PtaSyncState {
  /** 定时器是否在跑 */
  running: boolean;
  /** 最近一次尝试同步的时间 */
  lastAttemptAt: string | null;
  /** 最近一次成功同步的时间 */
  lastSuccessAt: string | null;
  /** 最近一次失败原因，成功后清空 */
  lastError: string | null;
  /** 最近一次成功同步匹配到的选手数（按学号） */
  matchedCount: number | null;
  /** 最近一次成功同步未匹配到的选手数 */
  unmatchedCount: number | null;
  unmatchedPlayers: string[];
  /** 名单里同一学号重复、无法判断归属的选手 */
  ambiguousPlayers: string[];
  /** 名单中没有学号、永远无法参与匹配的人数 */
  rosterWithoutStudentNumber: number | null;
}

type SyncRecord = Omit<PtaSyncState, "running">;

function nowText(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403/.test(msg)) {
    return `PTA 认证失败，Cookie 可能已过期（${msg}）`;
  }
  return msg;
}

function recordSuccess(
  competitionId: number,
  attemptAt: string,
  matchedCount: number,
  unmatchedPlayers: string[],
  ambiguousPlayers: string[],
  rosterWithoutStudentNumber: number
): void {
  syncStates.set(competitionId, {
    lastAttemptAt: attemptAt,
    lastSuccessAt: attemptAt,
    lastError: null,
    matchedCount,
    unmatchedCount: unmatchedPlayers.length,
    unmatchedPlayers,
    ambiguousPlayers,
    rosterWithoutStudentNumber,
  });
}

function recordFailure(
  competitionId: number,
  attemptAt: string,
  error: string
): void {
  const prev = syncStates.get(competitionId);
  syncStates.set(competitionId, {
    lastAttemptAt: attemptAt,
    lastSuccessAt: prev?.lastSuccessAt ?? null,
    lastError: error,
    matchedCount: prev?.matchedCount ?? null,
    unmatchedCount: prev?.unmatchedCount ?? null,
    unmatchedPlayers: prev?.unmatchedPlayers ?? [],
    ambiguousPlayers: prev?.ambiguousPlayers ?? [],
    rosterWithoutStudentNumber: prev?.rosterWithoutStudentNumber ?? null,
  });
}

export async function syncOnce(competitionId: number): Promise<number> {
  if (syncInProgress.has(competitionId)) return 0;
  syncInProgress.add(competitionId);

  const attemptAt = nowText();

  try {
    const db = await getDb();

    const compRows = db.exec(
      `SELECT access_cookie, pta_contest_id FROM competitions WHERE id = ${competitionId}`
    );
    if (compRows.length === 0 || compRows[0].values.length === 0) {
      recordFailure(competitionId, attemptAt, "比赛不存在");
      return 0;
    }

    const comp = compRows[0].values[0];
    const cookie = ((comp[0] as string) || "").trim();
    const ptaContestId = ((comp[1] as string) || "").trim();

    if (!cookie || !ptaContestId) {
      recordFailure(competitionId, attemptAt, "未配置 PTA 比赛 ID 或 Cookie");
      return 0;
    }

    const problems = await fetchPtaProblemTypes(ptaContestId, cookie).catch(
      (err) => {
        // 题库接口对“复盘/练习”类题目集可能返回空 labels，榜单自带映射才是权威来源
        console.warn(
          `[pta-sync] 题目类型接口不可用，改用榜单自带题目映射: ${describeError(err)}`
        );
        return [] as Awaited<ReturnType<typeof fetchPtaProblemTypes>>;
      }
    );
    const rankings = await fetchPtaAllRankings(ptaContestId, cookie);
    const players = transformPtaData(problems, rankings);

    const memberRows = db.exec(`
      SELECT m.id, m.name FROM members m
      JOIN teams t ON t.id = m.team_id
      WHERE t.competition_id = ${competitionId}
    `);

    const roster = memberRows.length > 0
      ? memberRows[0].values.map((row) => ({
          id: row[0] as number,
          name: String(row[1] ?? ""),
        }))
      : [];
    // 名单里没有学号的成员永远无法按学号匹配，单独统计便于后台提醒
    const rosterWithoutStudentNumber = roster.filter(
      (m) => !parseMemberName(m.name).studentNumber
    ).length;

    // 满分是固定规则，直接用常量表；不要依赖题目接口（拿不到题目时会导致 maxScore 全为 0）
    const labelToMaxScore: Record<string, number> = {};
    PROBLEM_LABELS.forEach((label, i) => {
      labelToMaxScore[label] = ALL_MAX_SCORES[i];
    });

    let matchedCount = 0;
    const unmatchedPlayers: string[] = [];
    const ambiguousPlayers: string[] = [];

    for (const player of players) {
      // 严格按学号匹配（不参考姓名，避免「王梦」吃掉「王梦帆」这类串号）
      const result = matchMember(player, roster);
      const display = player.studentNumber
        ? `${player.studentNumber} ${player.name}`.trim()
        : player.name;

      if (!result.memberId) {
        if (result.reason === "ambiguous") {
          ambiguousPlayers.push(display);
          continue;
        }
        // 零提交的选手不在名单里很正常，不纳入“未匹配”统计，避免数字虚高
        const hasScore = Object.values(player.score).some((s) => s > 0);
        if (hasScore) unmatchedPlayers.push(display);
        continue;
      }
      const memberId = result.memberId;
      matchedCount++;

      for (const label of PROBLEM_LABELS) {
        // 以 PTA 为准逐题覆盖：PTA 没返回的题就是 0 分。
        // 否则复用比赛记录、换了 PTA 比赛后，上一场的分数会残留在这个人名下。
        const score = player.score[label] ?? 0;
        const maxScore = labelToMaxScore[label] || 0;
        const acceptTime = player.acceptTime[label] || 0;
        const acceptTimeSql =
          score > 0 && acceptTime > 0 ? String(acceptTime) : "NULL";
        db.run(
          `INSERT INTO scores (member_id, problem_label, score, max_score, accept_time, updated_at)
           VALUES (${memberId}, ${esc(label)}, ${Math.round(score) || 0}, ${maxScore}, ${acceptTimeSql}, datetime('now', 'localtime'))
           ON CONFLICT(member_id, problem_label) DO UPDATE SET
             score = excluded.score,
             max_score = excluded.max_score,
             accept_time = excluded.accept_time,
             updated_at = excluded.updated_at`
        );
      }
    }

    saveDb();
    recordSuccess(
      competitionId,
      attemptAt,
      matchedCount,
      unmatchedPlayers,
      ambiguousPlayers,
      rosterWithoutStudentNumber
    );
    return matchedCount;
  } catch (err) {
    const message = describeError(err);
    console.error(`PTA sync failed for competition ${competitionId}:`, err);
    recordFailure(competitionId, attemptAt, message);
    return 0;
  } finally {
    syncInProgress.delete(competitionId);
  }
}

export function startPtaSync(competitionId: number, intervalSec = 60): void {
  if (syncTimers.has(competitionId)) {
    return;
  }

  syncOnce(competitionId);

  const timer = setInterval(() => {
    syncOnce(competitionId).catch((err) => {
      console.error(`PTA sync error for ${competitionId}:`, err);
    });
  }, intervalSec * 1000);

  syncTimers.set(competitionId, timer);
}

export function stopPtaSync(competitionId: number): void {
  const timer = syncTimers.get(competitionId);
  if (timer) {
    clearInterval(timer);
    syncTimers.delete(competitionId);
  }
}

export function getPtaSyncStatus(competitionId: number): PtaSyncState {
  const record = syncStates.get(competitionId);
  return {
    running: syncTimers.has(competitionId),
    lastAttemptAt: record?.lastAttemptAt ?? null,
    lastSuccessAt: record?.lastSuccessAt ?? null,
    lastError: record?.lastError ?? null,
    matchedCount: record?.matchedCount ?? null,
    unmatchedCount: record?.unmatchedCount ?? null,
    unmatchedPlayers: record?.unmatchedPlayers ?? [],
    ambiguousPlayers: record?.ambiguousPlayers ?? [],
    rosterWithoutStudentNumber: record?.rosterWithoutStudentNumber ?? null,
  };
}

export function stopAllPtaSync(): void {
  for (const [id] of syncTimers) {
    stopPtaSync(id);
  }
}
