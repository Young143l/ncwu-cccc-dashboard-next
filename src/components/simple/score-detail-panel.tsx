"use client";

import { useScore } from "@/context/score-context";
import { PROBLEM_LABELS, ALL_MAX_SCORES } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function getLevelColor(level: string) {
  switch (level) {
    case "basic":
      return "border-primary bg-primary/5";
    case "advanced":
      return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950";
    case "top":
      return "border-red-500 bg-red-50 dark:bg-red-950";
    default:
      return "border-border";
  }
}

function getLevelLabel(level: string) {
  switch (level) {
    case "basic":
      return "基础级";
    case "advanced":
      return "进阶级";
    case "top":
      return "登顶级";
    default:
      return level;
  }
}

export function ScoreDetailPanel() {
  const { state, dispatch, getSelectedMember, getSelectedTeam } = useScore();
  const member = getSelectedMember();
  const team = getSelectedTeam();
  const open = !!member;

  if (!open) return null;

  const levels = [
    { key: "basic", range: [0, 8] as const },
    { key: "advanced", range: [8, 12] as const },
    { key: "top", range: [12, 15] as const },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dispatch({ type: "SELECT_MEMBER", memberId: null as unknown as string });
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {member?.name || ""}
            {team && (
              <span className="text-muted-foreground text-sm ml-2 font-normal">
                {team.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto max-h-96">
          {levels.map(({ key, range }) => {
            const levelScores = member?.scores.slice(range[0], range[1]) || [];
            const total = levelScores.reduce((s, q) => s + q.score, 0);
            const max = levelScores.reduce((s, q) => s + q.maxScore, 0);

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold">{getLevelLabel(key)}</span>
                  <span className="text-sm tabular-nums">
                    {total} / {max}
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {levelScores.map((q, i) => {
                    const pct = q.maxScore > 0 ? (q.score / q.maxScore) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded min-w-[48px] border ${
                          q.score >= q.maxScore
                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                            : q.score > 0
                            ? getLevelColor(key)
                            : "border-border opacity-50"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground font-medium">
                          {PROBLEM_LABELS[range[0] + i]}
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {q.score}
                        </span>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 pt-3 border-t text-sm text-muted-foreground">
          <span>
            有效总分：
            <strong className="text-primary text-base">
              {member?.totalScore || 0}
            </strong>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
