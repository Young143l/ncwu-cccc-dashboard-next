"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, MoreVertical, Trophy } from "lucide-react";
import {
  getCompetitions,
  deleteCompetition,
  updateCompetitionStatus,
  type CompetitionSummary,
} from "@/services/api";
import { PageHeader } from "@/components/simple/page-header";
import { EmptyState } from "@/components/simple/empty-state";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import { StatusBadge } from "@/components/simple/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompetitionSummary | null>(null);
  const [confirmFinish, setConfirmFinish] = useState<CompetitionSummary | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await getCompetitions();
      setCompetitions(data);
    } catch (err) {
      console.error(err);
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCompetition(confirmDelete.id);
    await load();
  };

  const handleFinish = async () => {
    if (!confirmFinish) return;
    await updateCompetitionStatus(confirmFinish.id, "finished");
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="比赛管理"
        actions={
          <Button onClick={() => router.push("/create")}>创建比赛</Button>
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <EmptyState
            icon={AlertCircle}
            title="加载失败"
            description="无法连接到服务器"
            action={{ label: "重试", onClick: load }}
          />
        )}

        {!error && loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !error && competitions.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="还没有比赛"
            description="点击右上角按钮创建第一个比赛"
            action={{ label: "创建比赛", onClick: () => router.push("/create") }}
          />
        ) : (
          !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitions.map((comp) => (
                <Card
                  key={comp.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={comp.status} />
                      <span className="text-xs text-muted-foreground">
                        {comp.created_at}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base mb-3">
                      {comp.name}
                    </CardTitle>
                    {comp.start_time && (
                      <div className="text-xs text-primary mb-2">
                        {comp.start_time.replace("T", " ")}
                        {comp.status === "upcoming" && comp.duration_minutes && (
                          <span className="text-muted-foreground">
                            {" "}
                            &middot; {comp.duration_minutes}分钟
                          </span>
                        )}
                      </div>
                    )}
                    {comp.pta_contest_id && (
                      <div className="text-xs text-muted-foreground mb-3">
                        PTA ID: {comp.pta_contest_id}
                      </div>
                    )}
                    <div className="flex gap-4 mb-3">
                      <div>
                        <span className="text-lg font-bold text-primary">
                          {comp.team_count}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          队伍
                        </span>
                      </div>
                      <div>
                        <span className="text-lg font-bold text-primary">
                          {comp.member_count}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          选手
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/competitions/${comp.id}`)}
                      >
                        管理
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {comp.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => setConfirmFinish(comp)}
                            >
                              结束比赛
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmDelete(comp)}
                          >
                            删除比赛
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </main>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="确认删除比赛"
        description={
          <span>
            确定要删除比赛「{confirmDelete?.name}」吗？此操作不可恢复，比赛的所有队伍、选手和成绩都将被删除。
          </span>
        }
        confirmLabel="删除"
        destructive
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!confirmFinish}
        onOpenChange={(v) => !v && setConfirmFinish(null)}
        title="确认结束比赛"
        description={
          <span>
            确定要将比赛「{confirmFinish?.name}」标记为已结束吗？结束后无法恢复活动状态。
          </span>
        }
        confirmLabel="结束"
        onConfirm={handleFinish}
      />
    </div>
  );
}
