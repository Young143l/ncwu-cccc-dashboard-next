import { PROBLEM_LABELS } from "@/types";

const PTA_API = "https://pintia.cn/api";
const PAGE_SIZE = 50;

interface PtaProblemLabel {
  id: string;
  label: string;
  score: number;
  title: string;
  type: string;
}

interface PtaProblemScore {
  score: number;
  acceptTime?: number;
  validSubmitCount?: number;
}

/** 榜单接口对“考试型”题目集返回对象，对“复盘/练习”型题目集直接返回分数数字 */
type PtaProblemScoreValue = number | PtaProblemScore;

interface PtaRankingEntry {
  rank: number;
  user: { userId: string; studentUserId: string };
  totalScore: number;
  problemScoreByProblemSetProblemId: Record<string, PtaProblemScoreValue>;
}

interface PtaRankingResponse {
  total: number;
  userById: Record<string, { nickname: string }>;
  studentUserById?: Record<string, { studentNumber: string; name: string }>;
  labels: string[];
  commonRankings: PtaRankingEntry[];
  labelByProblemSetProblemId?: Record<string, string>;
}

export interface PtaPlayerScore {
  name: string;
  score: Record<string, number>;
  acceptTime: Record<string, number>;
}

export async function fetchPtaProblemTypes(
  contestId: string,
  cookie: string
): Promise<PtaProblemLabel[]> {
  const res = await fetch(
    `${PTA_API}/problem-sets/${contestId}/exam-problem-types`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
      },
    }
  );
  if (!res.ok) throw new Error(`获取题目类型失败: ${res.status}`);
  const data = await res.json();
  return data.labels || [];
}

export async function fetchPtaRankingsPage(
  contestId: string,
  cookie: string,
  page: number
): Promise<PtaRankingResponse> {
  const res = await fetch(
    `${PTA_API}/problem-sets/${contestId}/common-rankings?page=${page}&limit=${PAGE_SIZE}`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
      },
    }
  );
  if (!res.ok) throw new Error(`获取排名失败: ${res.status}`);
  return res.json();
}

export async function fetchPtaAllRankings(
  contestId: string,
  cookie: string
): Promise<PtaRankingResponse> {
  const firstPage = await fetchPtaRankingsPage(contestId, cookie, 0);
  const allEntries = [...firstPage.commonRankings];

  // 每页响应只带自己那页的 userById / studentUserById / 题目映射，必须逐页合并，
  // 否则第二页之后的选手会全部变成“未知”（无法按姓名匹配）。
  const userById = { ...firstPage.userById };
  const studentUserById = { ...(firstPage.studentUserById ?? {}) };
  const labelByProblemSetProblemId = {
    ...(firstPage.labelByProblemSetProblemId ?? {}),
  };

  const totalPages = Math.ceil(firstPage.total / PAGE_SIZE);
  for (let p = 1; p < totalPages; p++) {
    const page = await fetchPtaRankingsPage(contestId, cookie, p);
    allEntries.push(...page.commonRankings);
    Object.assign(userById, page.userById);
    Object.assign(studentUserById, page.studentUserById ?? {});
    Object.assign(
      labelByProblemSetProblemId,
      page.labelByProblemSetProblemId ?? {}
    );
  }

  return {
    ...firstPage,
    commonRankings: allEntries,
    userById,
    studentUserById,
    labelByProblemSetProblemId,
  };
}

export function transformPtaData(
  problems: PtaProblemLabel[],
  rankings: PtaRankingResponse
): PtaPlayerScore[] {
  // 榜单自带的题目 ID → 题号映射是权威来源；
  // exam-problem-types 对“复盘/练习”类题目集会返回空 labels，此时靠它才能拿到分数。
  const labelByProblemId = rankings.labelByProblemSetProblemId || {};
  const hasLabelMap = Object.keys(labelByProblemId).length > 0;
  const problemIdOrder = problems.map((p) => p.id);

  return rankings.commonRankings.map((entry) => {
    const studentUser = rankings.studentUserById?.[entry.user.studentUserId];
    const name = studentUser?.name?.trim()
      || rankings.userById[entry.user.userId]?.nickname?.trim()
      || "未知";
    const score: Record<string, number> = {};
    const acceptTime: Record<string, number> = {};

    for (const [probId, rawValue] of Object.entries(
      entry.problemScoreByProblemSetProblemId
    )) {
      let label: string | null = null;
      if (hasLabelMap) {
        label = labelByProblemId[probId] ?? null;
      } else {
        const idx = problemIdOrder.indexOf(probId);
        if (idx >= 0 && idx < PROBLEM_LABELS.length) {
          label = PROBLEM_LABELS[idx];
        }
      }
      if (!label || !PROBLEM_LABELS.includes(label)) continue;

      const probScore = typeof rawValue === "number" ? rawValue : rawValue?.score ?? 0;
      const probAcceptTime =
        typeof rawValue === "number" ? 0 : rawValue?.acceptTime ?? 0;

      score[label] = probScore;
      if (probAcceptTime > 0) {
        acceptTime[label] = probAcceptTime;
      }
    }

    return { name, score, acceptTime };
  });
}

export type SyncResult = {
  players: PtaPlayerScore[];
  matchedCount: number;
  unmatchedPlayers: string[];
};
