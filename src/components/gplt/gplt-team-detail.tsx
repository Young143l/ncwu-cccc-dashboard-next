"use client";

import { useScore } from "@/context/score-context";
import { PROBLEM_LABELS } from "@/types";

export function GpltTeamDetail() {
  const { state, dispatch } = useScore();
  const team = state.teams.find((t) => t.id === state.selectedTeamId);

  if (!team) return null;

  return (
    <div
      className="overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={() => dispatch({ type: "SELECT_TEAM", teamId: null as unknown as string })}
    >
      <div
        className="container_WX_L3"
        style={{
          background: "hsla(213, 11%, 20%, 0.95)",
          border: "1px solid hsla(175, 100%, 62%, 0.6)",
          borderRadius: 8,
          padding: "24px 32px",
          maxWidth: 700,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="name_AuJI0" style={{ marginBottom: 16 }}>
          <div className="studentName_Ijs8B">{team.name}</div>
          <div className="teamName_rgf1B" style={{ fontSize: "1.2rem", color: "#7accec" }}>
            {team.members.length} 人 · 总分 {team.totalScore}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ color: "#7accec", padding: 8 }}>姓名</th>
              {PROBLEM_LABELS.map((label) => (
                <th key={label} style={{ color: "#7accec", padding: "4px 6px", fontSize: 12 }}>
                  {label}
                </th>
              ))}
              <th style={{ color: "#edb700", padding: 8 }}>总分</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr
                key={member.id}
                style={{ cursor: "pointer", borderBottom: "1px solid hsla(0,0%,100%,0.05)" }}
                onClick={() => {
                  dispatch({ type: "SELECT_MEMBER", memberId: member.id });
                  dispatch({ type: "SELECT_TEAM", teamId: null as unknown as string });
                }}
              >
                <td style={{ padding: 8, color: "#fff", fontWeight: 600 }}>{member.name}</td>
                {member.scores.map((s, i) => (
                  <td
                    key={i}
                    style={{
                      padding: "4px 6px",
                      textAlign: "center",
                      fontSize: 13,
                      color: s.score >= s.maxScore ? "#22c55e" : s.score > 0 ? "#fff" : "#555",
                      fontFamily: "monospace",
                    }}
                  >
                    {s.score}
                  </td>
                ))}
                <td style={{ padding: 8, textAlign: "center", color: "#edb700", fontWeight: 700, fontFamily: "GPLT-Number, monospace" }}>
                  {member.totalScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
