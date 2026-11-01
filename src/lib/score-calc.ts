import {
  BASIC_THRESHOLD, ADVANCED_THRESHOLD,
  MEMBER_BASIC_THRESHOLD, MEMBER_ADVANCED_THRESHOLD,
  PROBLEM_LABELS,
  type Team, type Member, type QuestionScore,
} from "@/types";

export function problemLabelToIndex(label: string): { level: "basic" | "advanced" | "top"; index: number } | null {
  const idx = PROBLEM_LABELS.indexOf(label);
  if (idx === -1) return null;
  if (idx < 8) return { level: "basic", index: idx };
  if (idx < 12) return { level: "advanced", index: idx - 8 };
  if (idx < 15) return { level: "top", index: idx - 12 };
  return null;
}

export function buildQuestionScores(
  scoreMap: Map<string, { score: number; maxScore: number; acceptTime?: number }>
): QuestionScore[] {
  return PROBLEM_LABELS.map((label) => {
    const found = scoreMap.get(label);
    return {
      problemLabel: label,
      score: found?.score ?? 0,
      maxScore: found?.maxScore ?? 0,
    };
  });
}

export function recalcMember(
  id: string,
  name: string,
  scores: QuestionScore[],
  ptaOrder: number | null = null
): Member {
  const basicScores = scores.filter((s) => {
    const info = problemLabelToIndex(s.problemLabel);
    return info?.level === "basic";
  });
  const advancedScores = scores.filter((s) => {
    const info = problemLabelToIndex(s.problemLabel);
    return info?.level === "advanced";
  });
  const topScores = scores.filter((s) => {
    const info = problemLabelToIndex(s.problemLabel);
    return info?.level === "top";
  });

  const basicTotal = basicScores.reduce((sum, s) => sum + s.score, 0);
  const advancedTotal = advancedScores.reduce((sum, s) => sum + s.score, 0);
  const topTotal = topScores.reduce((sum, s) => sum + s.score, 0);

  const advancedUnlocked = basicTotal >= MEMBER_BASIC_THRESHOLD;
  const topUnlocked = advancedUnlocked && advancedTotal >= MEMBER_ADVANCED_THRESHOLD;

  let totalScore = basicTotal;
  if (advancedUnlocked) totalScore += advancedTotal;
  if (topUnlocked) totalScore += topTotal;

  return {
    id,
    name,
    scores,
    ptaOrder,
    basicTotal,
    advancedTotal,
    topTotal,
    totalScore,
    advancedUnlocked,
    topUnlocked,
  };
}

export function recalcTeam(team: { id: string; name: string; members: Member[] }): Team {
  const members = team.members.map((m) =>
    recalcMember(m.id, m.name, m.scores, m.ptaOrder ?? null)
  );
  const basicTotal = members.reduce((sum, m) => sum + m.basicTotal, 0);
  const advancedTotal = members.reduce((sum, m) => sum + m.advancedTotal, 0);
  const topTotal = members.reduce((sum, m) => sum + m.topTotal, 0);

  const advancedUnlocked = basicTotal >= BASIC_THRESHOLD;
  const topUnlocked = advancedUnlocked && advancedTotal >= ADVANCED_THRESHOLD;

  let totalScore = basicTotal;
  if (advancedUnlocked) totalScore += advancedTotal;
  if (topUnlocked) totalScore += topTotal;

  return {
    id: team.id,
    name: team.name,
    members,
    basicTotal,
    advancedTotal,
    topTotal,
    totalScore,
    advancedUnlocked,
    topUnlocked,
  };
}

export function sortTeams(teams: Team[]): Team[] {
  // 同分时按队伍创建顺序（id）稳定排序，不依赖调用方传入的顺序
  return [...teams].sort(
    (a, b) =>
      b.totalScore - a.totalScore || Number(a.id) - Number(b.id)
  );
}

/**
 * 最后一次得分时间：该对象所有得分题里最晚的通过时间。
 * 无提交时间的数据源（复盘题目集、手工录入）返回 null。
 */
export function lastScoringTime(scores: QuestionScore[]): number | null {
  let latest = 0;
  for (const s of scores) {
    const t = s.acceptTime ?? 0;
    if (s.score > 0 && t > latest) latest = t;
  }
  return latest > 0 ? latest : null;
}

function teamLastScoringTime(team: Team): number | null {
  let latest = 0;
  for (const member of team.members) {
    const t = lastScoringTime(member.scores);
    if (t !== null && t > latest) latest = t;
  }
  return latest > 0 ? latest : null;
}

export interface RankedTeam {
  team: Team;
  rank: number;
}

/**
 * 团队排名：总分降序 → 最后一次得分时间早者在前 → 创建顺序。
 * 总分与时间都相同时并列（1,1,3）。
 */
export function rankTeams(teams: Team[]): RankedTeam[] {
  const hasTime = teams.some((t) => teamLastScoringTime(t) !== null);

  const sorted = [...teams].sort((a, b) => {
    const byScore = b.totalScore - a.totalScore;
    if (byScore !== 0) return byScore;

    if (hasTime) {
      const ta = teamLastScoringTime(a);
      const tb = teamLastScoringTime(b);
      if (ta === null && tb !== null) return 1;
      if (ta !== null && tb === null) return -1;
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    }

    return Number(a.id) - Number(b.id);
  });

  const ranked: RankedTeam[] = [];
  let prevScore = Number.NaN;
  let prevTime: number | null = null;
  let prevRank = 0;

  sorted.forEach((team, idx) => {
    const time = teamLastScoringTime(team);
    const tied = idx > 0 && team.totalScore === prevScore && time === prevTime;
    const rank = tied ? prevRank : idx + 1;
    ranked.push({ team, rank });
    prevScore = team.totalScore;
    prevTime = time;
    prevRank = rank;
  });

  return ranked;
}

export interface RankedMember {
  member: Member;
  teamId: string;
  teamName: string;
  /** 名次；PTA 比赛中未参加（榜单上没这个人）的成员为 null */
  rank: number | null;
}

/**
 * 个人排名：总分降序 → 最后一次得分时间早者在前 → PTA 榜位 → 创建顺序。
 * 不使用姓名作为任何层级的排序键。
 * 名次在名单内连续编号；未参加者排末尾，名次为 null。
 */
export function rankMembers(teams: Team[]): RankedMember[] {
  const all: Array<{ member: Member; teamId: string; teamName: string }> = [];
  for (const team of teams) {
    for (const member of team.members) {
      all.push({ member, teamId: team.id, teamName: team.name });
    }
  }

  const hasTime = all.some((x) => lastScoringTime(x.member.scores) !== null);
  // 名单里有人带 PTA 榜位，说明是 PTA 比赛：没有榜位的就是没参加
  const ptaMode = all.some((x) => x.member.ptaOrder != null);

  const participating = ptaMode
    ? all.filter((x) => x.member.ptaOrder != null)
    : all;
  const absent = ptaMode ? all.filter((x) => x.member.ptaOrder == null) : [];

  participating.sort((a, b) => {
    const byScore = b.member.totalScore - a.member.totalScore;
    if (byScore !== 0) return byScore;

    if (hasTime) {
      const ta = lastScoringTime(a.member.scores);
      const tb = lastScoringTime(b.member.scores);
      if (ta === null && tb !== null) return 1;
      if (ta !== null && tb === null) return -1;
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    }

    const oa = a.member.ptaOrder;
    const ob = b.member.ptaOrder;
    if (oa != null || ob != null) {
      if (oa == null) return 1;
      if (ob == null) return -1;
      if (oa !== ob) return oa - ob;
    }

    return Number(a.member.id) - Number(b.member.id);
  });

  absent.sort((a, b) => Number(a.member.id) - Number(b.member.id));

  return [
    ...participating.map((item, idx) => ({ ...item, rank: idx + 1 })),
    ...absent.map((item) => ({ ...item, rank: null })),
  ];
}
