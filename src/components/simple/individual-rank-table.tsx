"use client";

import { useMemo } from "react";
import { useScore } from "@/context/score-context";
import { useScoreAnimation } from "@/hooks/use-score-animation";
import type { Member } from "@/types";
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

export function IndividualRankTable({
  searchText,
}: {
  searchText?: string;
}) {
  const { state, dispatch } = useScore();

  const rankedMembers = useMemo(() => {
    const all: Array<{
      member: (typeof state.teams)[number]["members"][number];
      teamId: string;
      teamName: string;
    }> = [];
    for (const team of state.teams) {
      for (const member of team.members) {
        all.push({ member, teamId: team.id, teamName: team.name });
      }
    }

    const filtered = searchText
      ? all.filter(
          (item) =>
            item.member.name.includes(searchText) ||
            item.teamName.includes(searchText)
        )
      : all;

    filtered.sort(
      (a, b) =>
        b.member.totalScore - a.member.totalScore ||
        a.member.name.localeCompare(b.member.name)
    );
    return filtered.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [state.teams, searchText]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">#</TableHead>
          <TableHead className="text-center">姓名</TableHead>
          <TableHead className="text-center">队伍</TableHead>
          <TableHead className="text-center w-20">基础分</TableHead>
          <TableHead className="text-center w-20">进阶分</TableHead>
          <TableHead className="text-center w-20">登顶分</TableHead>
          <TableHead className="text-center w-20">总分</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rankedMembers.map((item) => (
          <IndividualRankRow
            key={item.member.id}
            item={item}
            isSelected={state.selectedMemberId === item.member.id}
            onClick={() =>
              dispatch({ type: "SELECT_MEMBER", memberId: item.member.id })
            }
          />
        ))}
        {rankedMembers.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center text-muted-foreground py-8"
            >
              暂无队员数据
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function IndividualRankRow({
  item,
  isSelected,
  onClick,
}: {
  item: {
    member: Member;
    teamName: string;
    rank: number;
  };
  isSelected: boolean;
  onClick: () => void;
}) {
  const flash = useScoreAnimation(item.member.totalScore);

  return (
    <TableRow
      className={`cursor-pointer transition-colors ${
        isSelected ? "bg-primary/5 shadow-[inset_3px_0_0] shadow-primary" : ""
      } ${flash ? "animate-pulse bg-yellow-50 dark:bg-yellow-950" : ""}`}
      onClick={onClick}
    >
      <TableCell className="text-center">
        {item.rank <= 3 ? (
          <MedalBadge rank={item.rank} />
        ) : (
          <span className="text-sm text-muted-foreground">{item.rank}</span>
        )}
      </TableCell>
      <TableCell className="text-center font-medium">
        {item.member.name}
      </TableCell>
      <TableCell className="text-center text-muted-foreground">
        {item.teamName}
      </TableCell>
      <TableCell className="text-center tabular-nums">
        {item.member.basicTotal}
      </TableCell>
      <TableCell
        className={`text-center tabular-nums ${
          !item.member.advancedUnlocked ? "text-muted-foreground" : ""
        }`}
      >
        {item.member.advancedTotal}
      </TableCell>
      <TableCell
        className={`text-center tabular-nums ${
          !item.member.topUnlocked ? "text-muted-foreground" : ""
        }`}
      >
        {item.member.topTotal}
      </TableCell>
      <TableCell className="text-center font-bold text-primary tabular-nums">
        {item.member.totalScore}
      </TableCell>
    </TableRow>
  );
}
