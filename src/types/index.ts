export const BASIC_SCORES = [5, 5, 10, 10, 15, 15, 20, 20];
export const ADVANCED_SCORES = [25, 25, 25, 25];
export const TOP_SCORES = [30, 30, 30];

export const ALL_MAX_SCORES = [...BASIC_SCORES, ...ADVANCED_SCORES, ...TOP_SCORES];

export const BASIC_THRESHOLD = 800;
export const ADVANCED_THRESHOLD = 400;

export const MEMBER_BASIC_THRESHOLD = 80;
export const MEMBER_ADVANCED_THRESHOLD = 40;

export const PROBLEM_LABELS = [
  "L1-1", "L1-2", "L1-3", "L1-4", "L1-5", "L1-6", "L1-7", "L1-8",
  "L2-1", "L2-2", "L2-3", "L2-4",
  "L3-1", "L3-2", "L3-3",
];

export interface QuestionScore {
  problemLabel: string;
  score: number;
  maxScore: number;
  acceptTime?: number;
}

export interface Member {
  id: string;
  name: string;
  scores: QuestionScore[];
  basicTotal: number;
  advancedTotal: number;
  topTotal: number;
  totalScore: number;
  advancedUnlocked: boolean;
  topUnlocked: boolean;
}

export interface Team {
  id: string;
  name: string;
  members: Member[];
  basicTotal: number;
  advancedTotal: number;
  topTotal: number;
  totalScore: number;
  advancedUnlocked: boolean;
  topUnlocked: boolean;
}

export interface ScoreState {
  teams: Team[];
  selectedTeamId: string | null;
  selectedMemberId: string | null;
  lastUpdatedMemberId: string | null;
  lastUpdatedTime: number | null;
}

export type ScoreAction =
  | { type: "SELECT_TEAM"; teamId: string }
  | { type: "SELECT_MEMBER"; memberId: string }
  | { type: "UPDATE_SCORE"; memberId: string; problemLabel: string; score: number }
  | { type: "BATCH_UPDATE"; updates: Array<{ memberId: string; problemLabel: string; score: number }> }
  | { type: "BATCH_REPLACE"; teams: Team[] };
