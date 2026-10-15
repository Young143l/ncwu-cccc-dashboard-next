import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";

const PTA_API = "https://pintia.cn/api";
const PAGE_SIZE = 50;

interface PtaProblemLabel {
  id: string;
  label: string;
  score: number;
  title: string;
  type: string;
}

interface PtaRankingEntry {
  rank: number;
  user: { userId: string; studentUserId: string };
  totalScore: number;
  problemScoreByProblemSetProblemId: Record<
    string,
    { score: number; acceptTime: number; validSubmitCount: number }
  >;
}

interface PtaRankingResponse {
  total: number;
  userById: Record<string, { nickname: string }>;
  studentUserById?: Record<string, { studentNumber: string; name: string }>;
  labels: string[];
  commonRankings: PtaRankingEntry[];
  labelByProblemSetProblemId: Record<string, string>;
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
  const totalPages = Math.ceil(firstPage.total / PAGE_SIZE);

  for (let p = 1; p < totalPages; p++) {
    const page = await fetchPtaRankingsPage(contestId, cookie, p);
    allEntries.push(...page.commonRankings);
  }

  return {
    ...firstPage,
    commonRankings: allEntries,
  };
}

export function transformPtaData(
  problems: PtaProblemLabel[],
  rankings: PtaRankingResponse
): PtaPlayerScore[] {
  const problemIdOrder = problems.map(p => p.id);

  return rankings.commonRankings.map((entry) => {
    const studentUser = rankings.studentUserById?.[entry.user.studentUserId];
    const name = studentUser?.name?.trim()
      || rankings.userById[entry.user.userId]?.nickname?.trim()
      || "未知";
    const score: Record<string, number> = {};
    const acceptTime: Record<string, number> = {};

    for (const [probId, probScore] of Object.entries(
      entry.problemScoreByProblemSetProblemId
    )) {
      const idx = problemIdOrder.indexOf(probId);
      if (idx === -1 || idx >= PROBLEM_LABELS.length) continue;
      score[PROBLEM_LABELS[idx]] = probScore.score;
      if (probScore.acceptTime > 0) {
        acceptTime[PROBLEM_LABELS[idx]] = probScore.acceptTime;
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
