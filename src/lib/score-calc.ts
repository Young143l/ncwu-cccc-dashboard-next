import {
  BASIC_SCORES, ADVANCED_SCORES, TOP_SCORES,
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
  scores: QuestionScore[]
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
    basicTotal,
    advancedTotal,
    topTotal,
    totalScore,
    advancedUnlocked,
    topUnlocked,
  };
}

export function recalcTeam(team: { id: string; name: string; members: Member[] }): Team {
  const members = team.members.map((m) => recalcMember(m.id, m.name, m.scores));
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
  return [...teams].sort((a, b) => b.totalScore - a.totalScore);
}

export function flattenMembers(teams: Team[]): Array<{
  member: Member;
  teamId: string;
  teamName: string;
  rank: number;
}> {
  const all: Array<{ member: Member; teamId: string; teamName: string }> = [];
  for (const team of teams) {
    for (const member of team.members) {
      all.push({ member, teamId: team.id, teamName: team.name });
    }
  }
  all.sort(
    (a, b) =>
      b.member.totalScore - a.member.totalScore ||
      a.member.name.localeCompare(b.member.name)
  );
  return all.map((item, idx) => ({ ...item, rank: idx + 1 }));
}
