"use client";

import { useScore } from "@/context/score-context";
import { useScoreAnimation } from "@/hooks/use-score-animation";
import type { Team } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function MedalBadge({ rank }: { rank: number }) {
  const colors = {
    1: "bg-yellow-500",
    2: "bg-gray-300",
    3: "bg-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
        colors[rank as keyof typeof colors] || ""
      }`}
    >
      {rank}
    </span>
  );
}

export function TeamRankRow({ team, rank }: { team: Team; rank: number }) {
  const { state, dispatch } = useScore();
  const isSelected = state.selectedTeamId === team.id;
  const flash = useScoreAnimation(team.totalScore);

  return (
    <TableRow
      className={`cursor-pointer transition-colors ${
        isSelected ? "bg-primary/5 shadow-[inset_3px_0_0] shadow-primary" : ""
      } ${flash ? "animate-pulse bg-yellow-50 dark:bg-yellow-950" : ""}`}
      onClick={() => dispatch({ type: "SELECT_TEAM", teamId: team.id })}
    >
      <TableCell className="text-center">
        {rank <= 3 ? (
          <MedalBadge rank={rank} />
        ) : (
          <span className="text-sm text-muted-foreground">{rank}</span>
        )}
      </TableCell>
      <TableCell className="text-center font-medium">{team.name}</TableCell>
      <TableCell className="text-center tabular-nums">
        {team.basicTotal}
      </TableCell>
      <TableCell
        className={`text-center tabular-nums ${
          !team.advancedUnlocked ? "text-muted-foreground" : ""
        }`}
      >
        {team.advancedTotal}
      </TableCell>
      <TableCell
        className={`text-center tabular-nums ${
          !team.topUnlocked ? "text-muted-foreground" : ""
        }`}
      >
        {team.topTotal}
      </TableCell>
      <TableCell className="text-center font-bold text-primary tabular-nums">
        {team.totalScore}
      </TableCell>
      <TableCell className="text-center text-muted-foreground">
        {team.members.length}
      </TableCell>
    </TableRow>
  );
}

export function TeamRankTable({ teams }: { teams: Team[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">#</TableHead>
          <TableHead className="text-center">队伍</TableHead>
          <TableHead className="text-center w-20">基础分</TableHead>
          <TableHead className="text-center w-20">进阶分</TableHead>
          <TableHead className="text-center w-20">登顶分</TableHead>
          <TableHead className="text-center w-20">总分</TableHead>
          <TableHead className="text-center w-12">人数</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team, idx) => (
          <TeamRankRow key={team.id} team={team} rank={idx + 1} />
        ))}
        {teams.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              暂无队伍数据
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
