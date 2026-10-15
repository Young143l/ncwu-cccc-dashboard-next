"use client";

import { useScore } from "@/context/score-context";

export function SimpleFooter() {
  const { state } = useScore();
  const teamCount = state.teams.length;
  const memberCount = state.teams.reduce((s, t) => s + t.members.length, 0);
  const lastUpdate = state.lastUpdatedTime
    ? new Date(state.lastUpdatedTime).toLocaleTimeString("zh-CN", {
        hour12: false,
      })
    : "-";

  return (
    <footer className="flex items-center justify-center gap-4 h-9 px-6 bg-card border-t text-sm text-muted-foreground shrink-0">
      <span>
        队伍 <strong className="text-foreground">{teamCount}</strong>
      </span>
      <span className="text-border">|</span>
      <span>
        选手 <strong className="text-foreground">{memberCount}</strong>
      </span>
      <span className="text-border">|</span>
      <span>
        更新 <strong className="text-foreground">{lastUpdate}</strong>
      </span>
    </footer>
  );
}
