import type { Team, Member } from "@/types";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";
import { recalcMember, recalcTeam } from "@/lib/score-calc";

export interface CompetitionApiData {
  id: number;
  name: string;
  created_at: string;
  status: string;
  start_time: string | null;
  duration_minutes: number | null;
  pta_contest_id: string | null;
  teams: Array<{
    id: number;
    name: string;
    members: Array<{
      id: number;
      name: string;
      scores: Array<{
        problem_label: string;
        score: number;
        max_score: number;
        accept_time: number | null;
      }>;
    }>;
  }>;
}

export function convertDetailToTeams(data: CompetitionApiData): Team[] {
  return data.teams.map((team) => {
    const members: Member[] = team.members.map((m) => {
      const existingMap = new Map(
        m.scores.map((s) => [s.problem_label, s])
      );
      const scores = PROBLEM_LABELS.map((label, i) => {
        const found = existingMap.get(label);
        return {
          problemLabel: label,
          score: found?.score ?? 0,
          maxScore: found?.max_score ?? ALL_MAX_SCORES[i] ?? 0,
          acceptTime: found?.accept_time ?? 0,
        };
      });
      return recalcMember(String(m.id), m.name, scores);
    });
    return recalcTeam({ id: String(team.id), name: team.name, members });
  });
}
