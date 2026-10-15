"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ScoreProvider, useScore } from "@/context/score-context";
import { getCompetition } from "@/services/api";
import {
  PROBLEM_LABELS, ALL_MAX_SCORES,
  type Team, type Member, type QuestionScore,
} from "@/types";
import { recalcMember, recalcTeam } from "@/lib/score-calc";
import { useTeamScoreFlash } from "@/hooks/use-score-animation";

function convertDetail(detail: {
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
}): Team[] {
  return detail.teams.map((team) => {
    const members: Member[] = team.members.map((m) => {
      const existingMap = new Map(m.scores.map((s) => [s.problem_label, s]));
      const scores: QuestionScore[] = PROBLEM_LABELS.map((label, i) => {
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

const POLL_INTERVAL_MS = 10_000;
const FIRST_BLOOD_PAGE_SIZE = 6;
const FIRST_BLOOD_PAGE_INTERVAL_MS = 8_000;
const SCROLL_INTERVAL_MS = 80;
const SCROLL_PAUSE_MS = 3_000;

function ProjectorPollingUpdater({ competitionId }: { competitionId: number }) {
  const { dispatch } = useScore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await getCompetition(competitionId);
      const teams = convertDetail(data);
      dispatch({ type: "BATCH_REPLACE", teams });
    } catch (err) {
      console.error("Poll failed:", err);
    }
  }, [competitionId, dispatch]);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [poll]);

  return null;
}

interface FirstBlood {
  problemLabel: string;
  problemIndex: number;
  memberName: string;
  teamName: string;
  acceptTime: number;
}

function useFirstBlood(): FirstBlood[] {
  const { state } = useScore();
  const result: FirstBlood[] = [];

  for (let i = 0; i < PROBLEM_LABELS.length; i++) {
    const label = PROBLEM_LABELS[i];
    let best: FirstBlood | null = null;

    for (const team of state.teams) {
      for (const member of team.members) {
        const score = member.scores.find((s) => s.problemLabel === label);
        if (score && score.score >= score.maxScore && score.maxScore > 0) {
          const acceptTime = score.acceptTime ?? 0;
          if (!best || acceptTime < best.acceptTime) {
            best = {
              problemLabel: label,
              problemIndex: i,
              memberName: member.name,
              teamName: team.name,
              acceptTime,
            };
          }
        }
      }
    }

    if (best) {
      result.push(best);
    }
  }

  return result;
}

function usePassRate(): Array<{
  label: string;
  index: number;
  passed: number;
  total: number;
  rate: number;
}> {
  const { state } = useScore();
  return PROBLEM_LABELS.map((label, i) => {
    let passed = 0;
    let total = 0;
    for (const team of state.teams) {
      for (const member of team.members) {
        total++;
        const score = member.scores.find((s) => s.problemLabel === label);
        if (score && score.score >= score.maxScore && score.maxScore > 0) {
          passed++;
        }
      }
    }
    return {
      label,
      index: i,
      passed,
      total,
      rate: total > 0 ? passed / total : 0,
    };
  });
}

interface CountdownState {
  phase: "unknown" | "upcoming" | "running" | "finished";
  remainingMs: number;
  totalMs: number;
  elapsedMs: number;
}

function parseStartTime(s: string): number {
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}+08:00`;
  return new Date(withZone).getTime();
}

function useCountdown(startTime: string | null, durationMinutes: number | null): CountdownState {
  const [state, setState] = useState<CountdownState>({
    phase: "unknown",
    remainingMs: 0,
    totalMs: 0,
    elapsedMs: 0,
  });

  useEffect(() => {
    if (!startTime) {
      setState({ phase: "unknown", remainingMs: 0, totalMs: 0, elapsedMs: 0 });
      return;
    }
    const start = parseStartTime(startTime);
    const totalMs = (durationMinutes || 180) * 60 * 1000;
    const update = () => {
      const now = Date.now();
      const elapsedMs = now - start;
      if (elapsedMs < 0) {
        setState({ phase: "upcoming", remainingMs: -elapsedMs, totalMs, elapsedMs: 0 });
      } else if (elapsedMs >= totalMs) {
        setState({ phase: "finished", remainingMs: 0, totalMs, elapsedMs });
      } else {
        setState({ phase: "running", remainingMs: totalMs - elapsedMs, totalMs, elapsedMs });
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTime, durationMinutes]);

  return state;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FirstBloodPanel({ firstBlood }: { firstBlood: FirstBlood[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(firstBlood.length / FIRST_BLOOD_PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [firstBlood.length]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, FIRST_BLOOD_PAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [totalPages]);

  const startIdx = page * FIRST_BLOOD_PAGE_SIZE;
  const pageItems = firstBlood.slice(startIdx, startIdx + FIRST_BLOOD_PAGE_SIZE);

  return (
    <div className="flex-1 overflow-hidden p-4 flex flex-col">
      <h2 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2 shrink-0">
        <span className="text-2xl">&#9876;</span>
        一血榜
      </h2>
      <div className="space-y-2 flex-1 overflow-hidden">
        {pageItems.length === 0 && (
          <p className="text-gray-500 text-sm">暂无数据</p>
        )}
        {pageItems.map((fb) => (
          <div
            key={fb.problemLabel}
            className="bg-white/5 rounded px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-blue-300">
                {fb.problemLabel}
              </span>
              <span className="text-yellow-400 text-lg font-bold font-mono">
                &#9733;
              </span>
            </div>
            <p className="text-base font-medium mt-1">
              {fb.memberName}
            </p>
            <p className="text-xs text-gray-400">{fb.teamName}</p>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 pt-2 shrink-0">
          {Array.from({ length: totalPages }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === page ? "bg-yellow-400" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PassRatePanel({
  passRates,
}: {
  passRates: Array<{
    label: string;
    index: number;
    passed: number;
    total: number;
    rate: number;
  }>;
}) {
  const groups = [
    { name: "基础级", items: passRates.slice(0, 8) },
    { name: "进阶级", items: passRates.slice(8, 12) },
    { name: "登顶级", items: passRates.slice(12, 15) },
  ];

  return (
    <div className="p-4 border-t border-white/10 overflow-y-auto min-h-0">
      <h2 className="text-sm font-bold text-blue-300 mb-2">通过率</h2>
      <div className="space-y-1.5">
        {groups.map((group) => (
          <div key={group.name}>
            <div className="text-xs text-gray-500 mb-0.5">{group.name}</div>
            {group.items.map((pr) => (
              <div key={pr.label} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-blue-300 w-10">
                  {pr.label}
                </span>
                <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pr.rate * 100}%`,
                      background:
                        pr.rate >= 0.7
                          ? "#22c55e"
                          : pr.rate >= 0.3
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  />
                </div>
                <span className="font-mono text-xs w-10 text-right text-gray-400">
                  {Math.round(pr.rate * 100)}%
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamRankRow({ team, rank }: { team: Team; rank: number }) {
  const flash = useTeamScoreFlash(team.id, team.totalScore);
  const isTop3 = rank <= 3;

  return (
    <div
      className={`flex items-center px-6 py-3 border-b border-white/5 transition-colors duration-500 ${
        isTop3 ? "bg-white/5" : ""
      } ${flash ? "bg-green-500/20" : ""}`}
    >
      <div className="w-16 text-center">
        {isTop3 ? (
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-bold ${
              rank === 1
                ? "bg-yellow-500 text-black"
                : rank === 2
                ? "bg-gray-300 text-black"
                : "bg-amber-700 text-white"
            }`}
          >
            {rank}
          </span>
        ) : (
          <span className="text-gray-400 text-lg font-mono">{rank}</span>
        )}
      </div>
      <div className="flex-1 text-center text-xl font-medium">
        {team.name}
      </div>
      <div className="w-20 text-center text-xl tabular-nums">
        {team.basicTotal}
      </div>
      <div
        className={`w-20 text-center text-xl tabular-nums ${
          !team.advancedUnlocked ? "text-gray-600" : ""
        }`}
      >
        {team.advancedTotal}
      </div>
      <div
        className={`w-20 text-center text-xl tabular-nums ${
          !team.topUnlocked ? "text-gray-600" : ""
        }`}
      >
        {team.topTotal}
      </div>
      <div className="w-24 text-center text-3xl font-bold text-yellow-400 tabular-nums">
        {team.totalScore}
      </div>
    </div>
  );
}

function ProjectorContent({
  compName,
  startTime,
  durationMinutes,
}: {
  compName: string;
  startTime: string | null;
  durationMinutes: number | null;
}) {
  const { state } = useScore();
  const firstBlood = useFirstBlood();
  const passRates = usePassRate();
  const countdown = useCountdown(startTime, durationMinutes);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollPauseRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pause scroll when new data arrives
  const lastUpdated = state.lastUpdatedTime;
  useEffect(() => {
    if (!lastUpdated) return;
    scrollPauseRef.current = true;
    const timer = setTimeout(() => {
      scrollPauseRef.current = false;
    }, SCROLL_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [lastUpdated]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const scrollInterval = setInterval(() => {
      if (scrollPauseRef.current) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += 1;
      }
    }, SCROLL_INTERVAL_MS);
    return () => clearInterval(scrollInterval);
  }, []);

  const progressPercent =
    countdown.phase === "running" && countdown.totalMs > 0
      ? Math.min(100, (countdown.elapsedMs / countdown.totalMs) * 100)
      : countdown.phase === "finished"
      ? 100
      : 0;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #1a2a4a 100%)",
        color: "#ffffff",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-wide">{compName}</h1>
        <div className="flex flex-col items-center gap-1">
          {countdown.phase === "unknown" ? (
            <span className="text-lg text-gray-500">时间未设置</span>
          ) : (
            <>
              <span
                className={`text-3xl font-bold font-mono ${
                  countdown.phase === "finished"
                    ? "text-red-400"
                    : countdown.phase === "upcoming"
                    ? "text-green-400"
                    : countdown.remainingMs < 600000
                    ? "text-yellow-400"
                    : "text-blue-300"
                }`}
              >
                {countdown.phase === "finished"
                  ? "比赛结束"
                  : countdown.phase === "upcoming"
                  ? `距离开始 ${formatCountdown(countdown.remainingMs)}`
                  : formatCountdown(countdown.remainingMs)}
              </span>
              <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    countdown.phase === "upcoming" ? "bg-green-400" : "bg-blue-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xl text-blue-300 font-mono">
            {currentTime.toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
          <span className="text-sm text-gray-500">
            刷新:{" "}
            {state.lastUpdatedTime
              ? new Date(state.lastUpdatedTime).toLocaleTimeString("zh-CN", {
                  hour12: false,
                })
              : "-"}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Left sidebar: First Blood + Pass Rate */}
        <div className="w-[360px] shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
          <FirstBloodPanel firstBlood={firstBlood} />
          <PassRatePanel passRates={passRates} />
        </div>

        {/* Main ranking */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center px-6 py-3 text-base text-gray-400 border-b border-white/10 shrink-0">
            <span className="w-16 text-center">排名</span>
            <span className="flex-1 text-center">队伍</span>
            <span className="w-20 text-center">基础分</span>
            <span className="w-20 text-center">进阶分</span>
            <span className="w-20 text-center">登顶分</span>
            <span className="w-24 text-center text-yellow-400 font-bold">
              总分
            </span>
          </div>

          {/* Scrollable list */}
          <div ref={listRef} className="flex-1 overflow-hidden">
            {state.teams.map((team, idx) => (
              <TeamRankRow key={team.id} team={team} rank={idx + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-2 px-8 text-center text-sm text-gray-500">
        华北水利水电大学信息工程学院
      </footer>
    </div>
  );
}

export default function ProjectorPage() {
  const { id } = useParams<{ id: string }>();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [compName, setCompName] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getCompetition(parseInt(id))
      .then((data) => {
        setCompName(data.name);
        setStartTime(data.start_time);
        setDurationMinutes(data.duration_minutes);
        setTeams(convertDetail(data));
      })
      .catch(() => setError("加载比赛数据失败"));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-red-400 text-xl">
        {error}
      </div>
    );
  }

  if (!teams) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center text-blue-300 text-xl">
        加载中...
      </div>
    );
  }

  return (
    <ScoreProvider initialTeams={teams}>
      <ProjectorPollingUpdater competitionId={parseInt(id!)} />
      <ProjectorContent
        compName={compName}
        startTime={startTime}
        durationMinutes={durationMinutes}
      />
    </ScoreProvider>
  );
}
