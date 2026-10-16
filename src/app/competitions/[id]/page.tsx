"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExcelImport } from "@/components/ui/excel-import";
import { downloadTeamsExcel } from "@/lib/excel-utils";
import { buildMemberSheet, splitStudentName } from "@/lib/excel-utils";
import { MoreVertical, RefreshCw, Trophy, X, Pencil, Loader2, ExternalLink, Download } from "lucide-react";
import {
  getCompetition,
  getSyncStatus,
  syncNow,
  type CompetitionDetail,
  type PtaSyncStatus,
} from "@/services/api";
import { ScoreProvider } from "@/context/score-context";
import { EmbeddedRank } from "@/components/simple/embedded-rank";
import { PageHeader } from "@/components/simple/page-header";
import { EmptyState } from "@/components/simple/empty-state";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import { StatusBadge } from "@/components/simple/status-badge";
import { TeamFormDialog } from "@/components/simple/team-form-dialog";
import { MemberBadges } from "@/components/simple/member-badges";
import { PtaConfigDialog } from "@/components/simple/pta-config-dialog";
import { convertDetailToTeams } from "@/lib/server-utils";
import { formatLocalDateTime, parseCompetitionTime } from "@/lib/competition-status";
import { PROBLEM_LABELS, ALL_MAX_SCORES, type QuestionScore } from "@/types";
import { recalcMember, recalcTeam } from "@/lib/score-calc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<{
    id: number;
    name: string;
    members: string;
  } | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<PtaSyncStatus | null>(null);
  const [syncMessage, setSyncMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCompetition(parseInt(id));
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadSyncStatus = useCallback(async () => {
    if (!id) return;
    try {
      setSyncStatus(await getSyncStatus(parseInt(id)));
    } catch {
      // 轮询失败静默处理，不打断页面
    }
  }, [id]);

  useEffect(() => {
    loadSyncStatus();
    const timer = setInterval(loadSyncStatus, 15_000);
    return () => clearInterval(timer);
  }, [loadSyncStatus]);

  const handleSync = async () => {
    if (!id) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      await syncNow(parseInt(id));
      const status = await getSyncStatus(parseInt(id));
      setSyncStatus(status);
      if (status.lastError) {
        setSyncMessage({ type: "error", text: `同步失败：${status.lastError}` });
      } else if (status.matchedCount !== null) {
        setSyncMessage({
          type: "ok",
          text: `同步完成，匹配 ${status.matchedCount} 名选手`,
        });
      } else {
        setSyncMessage({ type: "ok", text: "同步完成" });
      }
      await load();
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err instanceof Error ? err.message : "同步失败",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTeam = async (data: { name: string; members: string }) => {
    if (!id || !detail || !editingTeam) return;

    const memberNames = data.members
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const updatedTeams = editingTeam.id === 0
      ? [
          ...detail.teams,
          { id: 0, name: data.name, members: memberNames.map((name) => ({ id: 0, name, scores: [] })) },
        ]
      : detail.teams.map((t) =>
          t.id === editingTeam.id
            ? { ...t, name: data.name, members: memberNames.map((name) => ({ id: 0, name, scores: [] })) }
            : t
        );

    const res = await fetch(`/api/competitions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: updatedTeams }),
    });

    if (res.ok) {
      setEditingTeam(null);
      await load();
      setRefreshKey((v) => v + 1);
    }
  };

  const handleDeleteTeam = async () => {
    if (!id || !detail || !deletingTeam) return;
    const updatedTeams = detail.teams.filter((t) => t.id !== deletingTeam.id);
    const res = await fetch(`/api/competitions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: updatedTeams }),
    });
    if (res.ok) {
      await load();
      setRefreshKey((v) => v + 1);
    }
  };

  const handleExportTeamRank = () => {
    if (!detail) return;
    const teams = detail.teams.map((t) => {
      const members = t.members.map((m) => {
        const existingMap = new Map(m.scores.map((s) => [s.problem_label, s]));
        const scores: QuestionScore[] = PROBLEM_LABELS.map((label, i) => ({
          problemLabel: label,
          score: existingMap.get(label)?.score ?? 0,
          maxScore: existingMap.get(label)?.max_score ?? ALL_MAX_SCORES[i] ?? 0,
        }));
        return recalcMember(String(m.id), m.name, scores);
      });
      return recalcTeam({ id: String(t.id), name: t.name, members });
    }).sort((a, b) => b.totalScore - a.totalScore);

    const header = "排名,队伍,基础分,进阶分,登顶分,总分,人数,队员";
    const rows = teams.map((team, idx) => {
      const memberCol = team.members
        .map((m) => `${m.name}(${m.basicTotal}|${m.advancedTotal}|${m.topTotal}|${m.totalScore})`)
        .join(";");
      return `${idx + 1},${team.name},${team.basicTotal},${team.advancedTotal},${team.topTotal},${team.totalScore},${team.members.length},"${memberCol}"`;
    });
    const csv = header + "\n" + rows.join("\n");
    downloadCsv(csv, `${detail.name}-队伍排名`);
  };

  const handleExportIndividualRank = () => {
    if (!detail) return;
    const all: Array<{ name: string; team: string; basic: number; advanced: number; top: number; total: number }> = [];
    for (const t of detail.teams) {
      for (const m of t.members) {
        const existingMap = new Map(m.scores.map((s) => [s.problem_label, s]));
        const scores: QuestionScore[] = PROBLEM_LABELS.map((label, i) => ({
          problemLabel: label,
          score: existingMap.get(label)?.score ?? 0,
          maxScore: existingMap.get(label)?.max_score ?? ALL_MAX_SCORES[i] ?? 0,
        }));
        const member = recalcMember(String(m.id), m.name, scores);
        all.push({ name: member.name, team: t.name, basic: member.basicTotal, advanced: member.advancedTotal, top: member.topTotal, total: member.totalScore });
      }
    }
    all.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const header = "排名,姓名,队伍,基础分,进阶分,登顶分,总分";
    const rows = all.map((item, idx) => `${idx + 1},${item.name},${item.team},${item.basic},${item.advanced},${item.top},${item.total}`);
    const csv = header + "\n" + rows.join("\n");
    downloadCsv(csv, `${detail.name}-个人排名`);
  };

  const handleExportTeams = () => {
    if (!detail) return;
    downloadTeamsExcel(
      detail.teams.map((team) => ({
        name: team.name,
        members: team.members.map((m) => m.name),
      })),
      `${detail.name}-队伍名单`,
      buildMemberSheet(
        detail.teams.flatMap((team) =>
          team.members.map((m) => splitStudentName(m.name))
        )
      )
    );
  };

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="加载中..." backHref="/" />
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="比赛详情" backHref="/" />
        <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
          <EmptyState
            icon={Trophy}
            title="比赛不存在"
            description="该比赛可能已被删除"
            action={{ label: "返回首页", onClick: () => router.push("/") }}
          />
        </div>
      </div>
    );
  }

  const startMs = parseCompetitionTime(detail.start_time)?.getTime() ?? null;
  const endMs = parseCompetitionTime(detail.end_time)?.getTime() ?? null;
  // 有结束时间以实际时间窗口为准，避免 PTA 题目集的“可作答窗口”时长（可能上百天）误导
  const displayDurationMinutes =
    startMs !== null && endMs !== null && endMs > startMs
      ? Math.round((endMs - startMs) / 60000)
      : detail.duration_minutes;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={detail.name}
        backHref="/"
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSync}
            disabled={syncing}
            title="同步 PTA"
          >
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 比赛信息 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">比赛信息</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfigOpen(true)}
              >
                <Pencil />
                编辑配置
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">状态</span>
                <div className="mt-1">
                  <StatusBadge status={detail.status} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">开始时间</span>
                <p className="font-medium mt-1">
                  {formatLocalDateTime(detail.start_time) || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">结束时间</span>
                <p className="font-medium mt-1">
                  {formatLocalDateTime(detail.end_time) || "未设置"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">时长</span>
                <p className="font-medium mt-1">
                  {displayDurationMinutes || "-"} 分钟
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">队伍 / 选手</span>
                <p className="font-medium mt-1">
                  {detail.teams.length} /{" "}
                  {detail.teams.reduce((s, t) => s + t.members.length, 0)}
                </p>
              </div>
            </div>
            {detail.pta_contest_id && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">PTA ID: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {detail.pta_contest_id}
                </code>
              </div>
            )}
            <div className="mt-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">PTA 同步</span>
              {syncStatus?.running ? (
                syncStatus.lastError ? (
                  <span className="text-destructive">
                    异常：{syncStatus.lastError}
                  </span>
                ) : (
                  <span className="text-emerald-600">运行中（每 60 秒）</span>
                )
              ) : (
                <span className="text-muted-foreground">未启用</span>
              )}
              {!syncStatus?.running && syncStatus?.lastError && (
                <span className="text-destructive">
                  上次失败：{syncStatus.lastError}
                </span>
              )}
              {syncStatus?.lastSuccessAt ? (
                <span className="text-muted-foreground">
                  最后成功 {syncStatus.lastSuccessAt}
                </span>
              ) : (
                syncStatus?.lastAttemptAt && (
                  <span className="text-muted-foreground">
                    最后尝试 {syncStatus.lastAttemptAt}
                  </span>
                )
              )}
              {syncStatus?.lastSuccessAt && syncStatus.matchedCount !== null && (
                <span className="text-muted-foreground">
                  匹配 {syncStatus.matchedCount} 人
                  {syncStatus.unmatchedCount
                    ? `，未匹配 ${syncStatus.unmatchedCount} 人（名单姓名不一致）`
                    : ""}
                </span>
              )}
            </div>
            {syncMessage && (
              <p
                className={
                  syncMessage.type === "error"
                    ? "mt-2 text-sm text-destructive"
                    : "mt-2 text-sm text-muted-foreground"
                }
                role="status"
              >
                {syncMessage.text}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 快捷操作（合并大屏入口 + 操作） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(`/live/${id}/official`, "_blank")}
              >
                <ExternalLink />
                官方观赛版
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(`/live/${id}/projector`, "_blank")}
              >
                <ExternalLink />
                投屏大字版
              </Button>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {syncing ? "同步中..." : "手动同步 PTA"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTeamRank}
              >
                <Download />
                导出队伍排名
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportIndividualRank}
              >
                <Download />
                导出个人排名
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 队伍管理 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">队伍管理</CardTitle>
              <div className="flex items-center gap-1">
                <ExcelImport
                  onImport={(imported) => {
                    const updated = detail.teams.map((t, i) => {
                      const match = imported[i];
                      if (match) {
                        return { ...t, name: match.name, members: match.members.map((name) => ({ id: 0, name, scores: [] })) };
                      }
                      return t;
                    });
                    const remaining = imported.slice(detail.teams.length);
                    for (const r of remaining) {
                      updated.push({ id: 0, name: r.name, members: r.members.map((name) => ({ id: 0, name, scores: [] })) });
                    }
                    fetch(`/api/competitions/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ teams: updated }),
                    }).then(() => { load(); setRefreshKey((v) => v + 1); });
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportTeams}
                  disabled={detail.teams.length === 0}
                >
                  导出名单
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>队名</TableHead>
                  <TableHead>队员</TableHead>
                  <TableHead className="w-20">人数</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.teams.map((team, idx) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{team.name}</TableCell>
                    <TableCell>
                      <MemberBadges names={team.members.map((m) => m.name)} />
                    </TableCell>
                    <TableCell>{team.members.length}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditingTeam({
                                id: team.id,
                                name: team.name,
                                members: team.members
                                  .map((m) => m.name)
                                  .join(", "),
                              })
                            }
                          >
                            <Pencil />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeletingTeam({ id: team.id, name: team.name })
                            }
                          >
                            <X />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTeam({ id: 0, name: "", members: "" })}
              >
                + 添加队伍
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 嵌入排名 */}
        {detail && (
          <ScoreProvider
            key={`${detail.id}-${refreshKey}`}
            initialTeams={convertDetailToTeams(detail)}
          >
            <EmbeddedRank compId={parseInt(id!)} />
          </ScoreProvider>
        )}
      </main>

      {/* 队伍编辑/添加 Dialog */}
      <TeamFormDialog
        open={!!editingTeam}
        onOpenChange={(v) => !v && setEditingTeam(null)}
        mode={editingTeam?.id === 0 ? "add" : "edit"}
        initialName={editingTeam?.name}
        initialMembers={editingTeam?.members}
        onSave={handleSaveTeam}
      />

      {/* 比赛 / PTA 配置 Dialog */}
      <PtaConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        competition={{
          id: detail.id,
          name: detail.name,
          pta_contest_id: detail.pta_contest_id,
          start_time: detail.start_time,
          end_time: detail.end_time,
          duration_minutes: detail.duration_minutes,
          has_cookie: detail.has_cookie,
        }}
        onSaved={async () => {
          await load();
          await loadSyncStatus();
          setSyncMessage(null);
          setRefreshKey((v) => v + 1);
        }}
      />

      {/* 队伍删除确认 */}
      <ConfirmDialog
        open={!!deletingTeam}
        onOpenChange={(v) => !v && setDeletingTeam(null)}
        title="确认删除队伍"
        description={
          <span>
            确定要删除队伍「{deletingTeam?.name}」吗？该队伍所有成员和成绩将被一并删除，此操作不可恢复。
          </span>
        }
        confirmLabel="删除"
        destructive
        onConfirm={handleDeleteTeam}
      />
    </div>
  );
}
