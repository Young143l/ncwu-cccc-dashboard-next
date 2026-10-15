"use client";

import { useScore } from "@/context/score-context";
import { PROBLEM_LABELS } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TeamMembersModal() {
  const { state, dispatch } = useScore();
  const team = state.teams.find((t) => t.id === state.selectedTeamId);

  return (
    <Dialog
      open={!!state.selectedTeamId && !state.selectedMemberId}
      onOpenChange={(v) => {
        if (!v)
          dispatch({
            type: "SELECT_TEAM",
            teamId: null as unknown as string,
          });
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {team?.name || ""}
            <span className="text-muted-foreground text-sm ml-2 font-normal">
              {team?.members.length || 0} 人
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground">
                  姓名
                </th>
                {PROBLEM_LABELS.map((label) => (
                  <th
                    key={label}
                    className="p-2 text-center font-medium text-muted-foreground text-xs w-12"
                  >
                    {label}
                  </th>
                ))}
                <th className="p-2 text-center font-medium text-muted-foreground">
                  总分
                </th>
              </tr>
            </thead>
            <tbody>
              {team?.members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                  onClick={() =>
                    dispatch({
                      type: "SELECT_MEMBER",
                      memberId: member.id,
                    })
                  }
                >
                  <td className="p-2 font-medium">{member.name}</td>
                  {member.scores.map((s, i) => (
                    <td
                      key={i}
                      className={`p-2 text-center tabular-nums ${
                        s.score >= s.maxScore
                          ? "text-green-600 dark:text-green-400 font-bold"
                          : s.score > 0
                          ? ""
                          : "text-muted-foreground"
                      }`}
                    >
                      {s.score}
                    </td>
                  ))}
                  <td className="p-2 text-center font-bold text-primary tabular-nums">
                    {member.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
