"use client";

import { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type { ScoreState, ScoreAction, Team, Member } from "@/types";
import { recalcMember, recalcTeam, sortTeams } from "@/lib/score-calc";

function scoreReducer(state: ScoreState, action: ScoreAction): ScoreState {
  switch (action.type) {
    case "SELECT_TEAM":
      return { ...state, selectedTeamId: action.teamId, selectedMemberId: null };

    case "SELECT_MEMBER":
      return { ...state, selectedMemberId: action.memberId };

    case "UPDATE_SCORE": {
      const { memberId, problemLabel, score } = action;
      const teams = state.teams
        .map((team) => ({
          ...team,
          members: team.members.map((member) => {
            if (member.id !== memberId) return member;
            const updated = {
              ...member,
              scores: member.scores.map((s) =>
                s.problemLabel === problemLabel ? { ...s, score } : s
              ),
            };
            return recalcMember(updated.id, updated.name, updated.scores);
          }),
        }))
        .map((team) => recalcTeam(team));

      return {
        ...state,
        teams: sortTeams(teams),
        lastUpdatedMemberId: memberId,
        lastUpdatedTime: Date.now(),
      };
    }

    case "BATCH_UPDATE": {
      const updateMap = new Map<string, Map<string, number>>();
      for (const u of action.updates) {
        if (!updateMap.has(u.memberId)) updateMap.set(u.memberId, new Map());
        updateMap.get(u.memberId)!.set(u.problemLabel, u.score);
      }

      const teams = state.teams
        .map((team) => ({
          ...team,
          members: team.members.map((member) => {
            const updates = updateMap.get(member.id);
            if (!updates) return member;
            const updated = {
              ...member,
              scores: member.scores.map((s) => {
                const newScore = updates.get(s.problemLabel);
                return newScore !== undefined ? { ...s, score: newScore } : s;
              }),
            };
            return recalcMember(updated.id, updated.name, updated.scores);
          }),
        }))
        .map((team) => recalcTeam(team));

      const lastMemberId =
        action.updates.length > 0
          ? action.updates[action.updates.length - 1].memberId
          : null;

      return {
        ...state,
        teams: sortTeams(teams),
        lastUpdatedMemberId: lastMemberId,
        lastUpdatedTime: Date.now(),
      };
    }

    case "BATCH_REPLACE":
      return {
        ...state,
        teams: sortTeams(action.teams.map((team) => recalcTeam(team))),
        lastUpdatedTime: Date.now(),
      };
  }
}

interface ScoreContextValue {
  state: ScoreState;
  dispatch: React.Dispatch<ScoreAction>;
  getSelectedTeam: () => Team | undefined;
  getSelectedMember: () => Member | undefined;
}

const ScoreContext = createContext<ScoreContextValue | null>(null);

export function ScoreProvider({
  children,
  initialTeams,
}: {
  children: ReactNode;
  initialTeams: Team[];
}) {
  const [state, dispatch] = useReducer(scoreReducer, {
    teams: sortTeams(initialTeams),
    selectedTeamId: null,
    selectedMemberId: null,
    lastUpdatedMemberId: null,
    lastUpdatedTime: null,
  });

  const getSelectedTeam = useCallback(() => {
    return state.teams.find((t) => t.id === state.selectedTeamId);
  }, [state.teams, state.selectedTeamId]);

  const getSelectedMember = useCallback(() => {
    for (const t of state.teams) {
      const m = t.members.find((m) => m.id === state.selectedMemberId);
      if (m) return m;
    }
    return undefined;
  }, [state.teams, state.selectedMemberId]);

  return (
    <ScoreContext.Provider
      value={{ state, dispatch, getSelectedTeam, getSelectedMember }}
    >
      {children}
    </ScoreContext.Provider>
  );
}

export function useScore() {
  const ctx = useContext(ScoreContext);
  if (!ctx) throw new Error("useScore must be used within ScoreProvider");
  return ctx;
}
