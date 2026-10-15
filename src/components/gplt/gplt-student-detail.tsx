"use client";

import { useScore } from "@/context/score-context";
import { PROBLEM_LABELS } from "@/types";

function getLevelColor(idx: number): string {
  if (idx < 8) return "#7accec";
  if (idx < 12) return "#f7ce27";
  return "#f04f4f";
}

function getLevelLabel(idx: number): string {
  if (idx < 8) return "基础级";
  if (idx < 12) return "进阶级";
  return "登顶级";
}

export function GpltStudentDetail() {
  const { state, dispatch, getSelectedMember, getSelectedTeam } = useScore();
  const member = getSelectedMember();
  const team = getSelectedTeam();

  if (!member) return null;

  const basicScores = member.scores.filter((_, i) => i < 8);
  const advancedScores = member.scores.filter((_, i) => i >= 8 && i < 12);
  const topScores = member.scores.filter((_, i) => i >= 12);

  const levels = [
    { key: "basic", scores: basicScores, label: "基础级", color: "#7accec" },
    { key: "advanced", scores: advancedScores, label: "进阶级", color: "#f7ce27" },
    { key: "top", scores: topScores, label: "登顶级", color: "#f04f4f" },
  ];

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
      onClick={() => dispatch({ type: "SELECT_MEMBER", memberId: null as unknown as string })}
    >
      <div
        className="container_WX_L3"
        style={{
          background: "hsla(213, 11%, 20%, 0.95)",
          border: "1px solid hsla(175, 100%, 62%, 0.6)",
          borderRadius: 8,
          padding: "24px 32px",
          maxWidth: 640,
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="name_AuJI0" style={{ marginBottom: 16 }}>
          <div className="studentName_Ijs8B">{member.name}</div>
          {team && (
            <div className="teamName_rgf1B" style={{ color: "#7accec" }}>
              {team.name}
            </div>
          )}
        </div>

        {levels.map((level) => {
          const total = level.scores.reduce((s, q) => s + q.score, 0);
          const maxTotal = level.scores.reduce((s, q) => s + q.maxScore, 0);
          return (
            <div key={level.key} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: level.color,
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                <span>{level.label}</span>
                <span>
                  {total} / {maxTotal}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {level.scores.map((q, i) => {
                  const pct = q.maxScore > 0 ? (q.score / q.maxScore) * 100 : 0;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        padding: "6px 8px",
                        borderRadius: 4,
                        minWidth: 50,
                        border: `1px solid ${q.score >= q.maxScore ? "#22c55e" : level.color}33`,
                        background: q.score >= q.maxScore ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#888" }}>
                        {PROBLEM_LABELS[q.problemLabel ? PROBLEM_LABELS.indexOf(q.problemLabel) : 0] || "?"}
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: q.score >= q.maxScore ? "#22c55e" : "#fff",
                          fontFamily: "monospace",
                        }}
                      >
                        {q.score}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: 3,
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: level.color,
                            borderRadius: 2,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            color: "#999",
            fontSize: 14,
          }}
        >
          <span>
            有效总分：<strong style={{ color: "#edb700", fontSize: 18, fontFamily: "GPLT-Number, monospace" }}>
              {member.totalScore}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
