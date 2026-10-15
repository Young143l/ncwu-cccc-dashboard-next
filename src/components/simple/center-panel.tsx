"use client";

import { useState } from "react";
import { useScore } from "@/context/score-context";
import { TeamRankTable } from "@/components/simple/team-rank-card";
import { IndividualRankTable } from "@/components/simple/individual-rank-table";
import { ScoreDetailPanel } from "@/components/simple/score-detail-panel";
import { TeamMembersModal } from "@/components/simple/team-members-modal";

type TabKey = "team" | "individual";

export function CenterPanel() {
  const { state } = useScore();
  const [tab, setTab] = useState<TabKey>("team");
  const [searchText, setSearchText] = useState("");

  const filteredTeams = state.teams.filter(
    (team) =>
      !searchText ||
      team.name.includes(searchText) ||
      team.members.some((m) => m.name.includes(searchText))
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-card overflow-hidden">
      <ScoreDetailPanel />
      <TeamMembersModal />

      {/* Tabs + Search */}
      <div className="flex border-b shrink-0 max-w-4xl w-full mx-auto px-5">
        <button
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "team"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("team")}
        >
          队伍排名
        </button>
        <button
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "individual"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("individual")}
        >
          个人排名
        </button>
        <div className="ml-auto flex items-center">
          <input
            className="h-8 w-44 px-3 py-1 rounded-full bg-muted border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:w-52 transition-all"
            type="text"
            placeholder="搜索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              className="-ml-7 text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setSearchText("")}
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-5">
        {tab === "team" ? (
          <TeamRankTable teams={filteredTeams} />
        ) : (
          <IndividualRankTable searchText={searchText} />
        )}
      </div>
    </div>
  );
}
