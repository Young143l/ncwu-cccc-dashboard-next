"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useScore } from "@/context/score-context";
import { getCompetition } from "@/services/api";
import { TeamRankTable } from "@/components/simple/team-rank-card";
import { IndividualRankTable } from "@/components/simple/individual-rank-table";
import { ScoreDetailPanel } from "@/components/simple/score-detail-panel";
import { TeamMembersModal } from "@/components/simple/team-members-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { convertDetailToTeams, type CompetitionApiData } from "@/lib/server-utils";

export function EmbeddedRank({ compId }: { compId: number }) {
  const { state, dispatch } = useScore();
  const [tab, setTab] = useState<"team" | "individual">("team");
  const [searchText, setSearchText] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await getCompetition(compId);
      const teams = convertDetailToTeams(data as unknown as CompetitionApiData);
      dispatch({ type: "BATCH_REPLACE", teams });
    } catch (err) {
      console.error("Poll failed:", err);
    }
  }, [compId, dispatch]);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, 60_000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [poll]);

  const filteredTeams = state.teams.filter(
    (team) =>
      !searchText ||
      team.name.includes(searchText) ||
      team.members.some((m) => m.name.includes(searchText))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">实时排名</CardTitle>
      </CardHeader>
      <CardContent>
        <ScoreDetailPanel />
        <TeamMembersModal />

        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("team")}
          >
            队伍排名
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "individual"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("individual")}
          >
            个人排名
          </button>
          <div className="ml-auto">
            <input
              className="h-8 w-44 px-3 rounded-full bg-muted border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              type="text"
              placeholder="搜索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        {tab === "team" ? (
          <TeamRankTable teams={filteredTeams} />
        ) : (
          <IndividualRankTable searchText={searchText} />
        )}
      </CardContent>
    </Card>
  );
}
