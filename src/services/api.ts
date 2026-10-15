const BASE = "/api";

export interface CompetitionSummary {
  id: number;
  name: string;
  created_at: string;
  status: "active" | "finished" | "upcoming";
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  pta_contest_id: string | null;
  team_count: number;
  member_count: number;
}

export interface MemberScore {
  problem_label: string;
  score: number;
  max_score: number;
  accept_time: number | null;
}

export interface TeamMember {
  id: number;
  name: string;
  scores: MemberScore[];
}

export interface TeamData {
  id: number;
  name: string;
  members: TeamMember[];
}

export interface CompetitionDetail {
  id: number;
  name: string;
  created_at: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  pta_contest_id: string | null;
  has_cookie: boolean;
  teams: TeamData[];
}

export interface PtaSyncStatus {
  competitionId: number;
  running: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  matchedCount: number | null;
  unmatchedCount: number | null;
  unmatchedPlayers: string[];
}

export async function getCompetitions(): Promise<CompetitionSummary[]> {
  const res = await fetch(`${BASE}/competitions`);
  if (!res.ok) throw new Error("获取比赛列表失败");
  return res.json();
}

export async function getCompetition(id: number): Promise<CompetitionDetail> {
  const res = await fetch(`${BASE}/competitions/${id}`);
  if (!res.ok) throw new Error("获取比赛详情失败");
  return res.json();
}

export async function createCompetition(data: {
  name: string;
  teams: { name: string; members: string[] }[];
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  access_cookie?: string;
  pta_contest_id?: string;
}): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/competitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建比赛失败");
  return res.json();
}

export async function updateCompetition(
  id: number,
  data: {
    status?: string;
    name?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    access_cookie?: string;
    pta_contest_id?: string;
  }
): Promise<void> {
  const res = await fetch(`${BASE}/competitions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "保存失败");
  }
}

export async function getSyncStatus(id: number): Promise<PtaSyncStatus> {
  const res = await fetch(`${BASE}/competitions/${id}/sync-status`);
  if (!res.ok) throw new Error("获取同步状态失败");
  return res.json();
}

export async function deleteCompetition(id: number): Promise<void> {
  const res = await fetch(`${BASE}/competitions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除比赛失败");
}

export async function syncNow(id: number): Promise<{ updatedMembers: number }> {
  const res = await fetch(`${BASE}/competitions/${id}/sync-now`, {
    method: "POST",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.detail || body?.error || "同步失败");
  }
  return { updatedMembers: body?.updatedMembers ?? 0 };
}
