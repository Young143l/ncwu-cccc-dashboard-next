"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Download } from "lucide-react";
import { createCompetition } from "@/services/api";
import { ExcelImport } from "@/components/ui/excel-import";
import { PageHeader } from "@/components/simple/page-header";
import { ConfirmDialog } from "@/components/simple/confirm-dialog";
import { PtaCookieField } from "@/components/simple/pta-cookie-field";
import type { ExcelTeamData } from "@/lib/excel-utils";
import { downloadTeamsExcel, splitIntoTeams, buildMemberSheet } from "@/lib/excel-utils";
import { formatLocalDateTime } from "@/lib/competition-status";
import { toPtaCookieHeader } from "@/lib/pta-cookie";

interface TeamEntry {
  id: number;
  name: string;
  members: string;
}

const STEPS = [
  { id: "pta", label: "PTA 信息" },
  { id: "teams", label: "队伍与选手" },
  { id: "confirm", label: "确认提交" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function CreateCompetitionPage() {
  const router = useRouter();
  const [ptaId, setPtaId] = useState("");
  const [cookie, setCookie] = useState("");
  const [compName, setCompName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [teams, setTeams] = useState<TeamEntry[]>([
    { id: 1, name: "", members: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState<
    Array<{ name: string; studentNumber: string | null }>
  >([]);
  const [currentStep, setCurrentStep] = useState<StepId>("pta");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const nextIdRef = useRef(2);

  const allocId = () => {
    const id = nextIdRef.current;
    nextIdRef.current = id + 1;
    return id;
  };

  const handleFetch = async () => {
    setError("");
    if (!ptaId.trim()) {
      setError("请输入 PTA 比赛 ID");
      return;
    }
    if (!cookie.trim()) {
      setError("请输入 Access Cookie");
      return;
    }

    setFetching(true);
    try {
      const res = await fetch("/api/pta/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId: ptaId.trim(),
          cookie: toPtaCookieHeader(cookie),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "获取失败");
        return;
      }

      const data = await res.json();
      setCompName(data.name);
      setStartTime(data.startAt ? data.startAt.replace("T", " ") : "");
      setEndTime(data.endAt ? data.endAt.replace("T", " ") : "");
      setDurationMinutes(data.durationMinutes || 180);
      setParticipants(
        Array.isArray(data.participants) ? data.participants : []
      );
      setFetched(true);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setFetching(false);
    }
  };

  const addTeam = () => {
    setTeams([...teams, { id: allocId(), name: "", members: "" }]);
  };

  const removeTeam = (id: number) => {
    if (teams.length <= 1) return;
    setTeams(teams.filter((t) => t.id !== id));
  };

  const updateTeam = (id: number, field: "name" | "members", value: string) => {
    setTeams(teams.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleDownloadRosterTemplate = () => {
    if (participants.length === 0) return;
    const names = participants.map((p) =>
      p.studentNumber ? `${p.studentNumber} ${p.name}` : p.name
    );
    downloadTeamsExcel(
      splitIntoTeams(names),
      `${compName.trim() || "PTA用户组"}-导入模板`,
      buildMemberSheet(participants)
    );
  };

  const handleExcelImport = (imported: ExcelTeamData[]) => {
    const entries: TeamEntry[] = imported.map((t) => ({
      id: allocId(),
      name: t.name,
      members: t.members.join(", "),
    }));
    setTeams(entries);
  };

  const validTeams = useMemo(() => {
    return teams
      .map((team) => {
        const memberNames = team.members
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          name: team.name.trim(),
          members: memberNames,
          valid:
            team.name.trim().length > 0 &&
            memberNames.length > 0 &&
            memberNames.length <= 10,
        };
      })
      .filter((t) => t.valid || t.name.length > 0);
  }, [teams]);

  const canGoToTeams = fetched && compName.trim().length > 0;
  const canGoToConfirm = canGoToTeams && validTeams.length > 0 && validTeams.every((t) => t.valid);

  const handleConfirm = async () => {
    setError("");
    setSubmitting(true);
    try {
      await createCompetition({
        name: compName.trim(),
        teams: validTeams.map((t) => ({ name: t.name, members: t.members })),
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        duration_minutes: durationMinutes,
        access_cookie: toPtaCookieHeader(cookie),
        pta_contest_id: ptaId.trim(),
      });
      router.push("/");
    } catch {
      setError("创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="创建比赛"
        backHref="/"
        actions={
          <Button
            onClick={() => setConfirmSubmit(true)}
            disabled={submitting || !canGoToConfirm}
            size="sm"
          >
            创建比赛
          </Button>
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isPast =
              STEPS.findIndex((s) => s.id === currentStep) > idx;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isPast
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? <Check className="size-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs ${
                      isActive ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      isPast ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Tabs
          value={currentStep}
          onValueChange={(v) => {
            const step = v as StepId;
            if (step === "teams" && !canGoToTeams) return;
            if (step === "confirm" && !canGoToConfirm) return;
            setCurrentStep(step);
          }}
        >
          <TabsList className="hidden">
            <TabsTrigger value="pta">PTA</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="confirm">Confirm</TabsTrigger>
          </TabsList>

          {/* Tab 1: PTA 信息 */}
          <TabsContent value="pta" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>PTA 信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ptaId">PTA 比赛 ID</Label>
                  <Input
                    id="ptaId"
                    value={ptaId}
                    onChange={(e) => setPtaId(e.target.value)}
                    placeholder="例如：2045465562920992768"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cookie">PTA Cookie</Label>
                  <PtaCookieField
                    id="cookie"
                    value={cookie}
                    onChange={setCookie}
                    disabled={fetching}
                  />
                </div>
                <Button onClick={handleFetch} disabled={fetching}>
                  {fetching ? "获取中..." : "获取比赛名称"}
                </Button>
                {fetched && (
                  <div className="space-y-2">
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                      比赛名称: {compName}
                    </div>
                    {participants.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          已获取 {participants.length} 名参赛人员
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadRosterTemplate}
                        >
                          <Download />
                          下载导入模板
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep("teams")}
                disabled={!canGoToTeams}
              >
                下一步：队伍与选手
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: 队伍与选手 */}
          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>队伍管理</CardTitle>
                  <div className="flex items-center gap-1">
                    <ExcelImport onImport={handleExcelImport} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadRosterTemplate}
                      disabled={participants.length === 0}
                      title={
                        participants.length === 0
                          ? "请先在「PTA 信息」步骤拉取用户组名单"
                          : undefined
                      }
                    >
                      按名单生成模板
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[1fr_2fr_auto] gap-3 text-sm text-muted-foreground px-1 mb-1">
                  <span>队名</span>
                  <span>队员（逗号分隔）</span>
                  <span className="w-8" />
                </div>

                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center"
                  >
                    <Input
                      value={team.name}
                      onChange={(e) => updateTeam(team.id, "name", e.target.value)}
                      placeholder="队伍名称"
                    />
                    <Input
                      value={team.members}
                      onChange={(e) => updateTeam(team.id, "members", e.target.value)}
                      placeholder="张三, 李四, 王五"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive w-8 h-8 p-0"
                      onClick={() => removeTeam(team.id)}
                      disabled={teams.length <= 1}
                    >
                      &times;
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addTeam} className="mt-2">
                  + 添加队伍
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("pta")}>
                上一步
              </Button>
              <Button
                onClick={() => setCurrentStep("confirm")}
                disabled={!canGoToConfirm}
              >
                下一步：确认提交
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3: 确认提交 */}
          <TabsContent value="confirm" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>提交确认</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">比赛名称</div>
                  <div className="font-medium">{compName || "—"}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">开始时间 / 时长</div>
                  <div className="font-medium">
                    {formatLocalDateTime(startTime) || "—"}
                    {formatLocalDateTime(endTime)
                      ? ` ~ ${formatLocalDateTime(endTime).slice(11)}`
                      : ""}
                    &nbsp;&middot;&nbsp;{durationMinutes} 分钟
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("pta")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">PTA ID</div>
                  <div className="font-medium">{ptaId || "—"}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep("teams")}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                >
                  <div className="text-muted-foreground">队伍 / 选手</div>
                  <div className="font-medium">
                    {validTeams.length} 队 / {validTeams.reduce((s, t) => s + t.members.length, 0)} 人
                  </div>
                </button>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("teams")}>
                上一步
              </Button>
              <Button
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting || !canGoToConfirm}
              >
                {submitting ? "创建中..." : "创建比赛"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="确认创建比赛"
        description={
          <span>
            将创建比赛「{compName}」，包含 {validTeams.length} 队 {validTeams.reduce((s, t) => s + t.members.length, 0)} 人。
          </span>
        }
        confirmLabel="创建"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
