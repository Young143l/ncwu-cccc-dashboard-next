"use client";

import { useMemo } from "react";
import { useScore } from "@/context/score-context";
import { useScoreAnimation } from "@/hooks/use-score-animation";
import type { Team } from "@/types";

const GPLT = "/gplt";
const PROGRESS_BLUE = `${GPLT}/team-assets/3079c545-5b3e-4bc9-8e01-71d42490b25c.png`;
const PROGRESS_YELLOW = `${GPLT}/team-assets/0394fbe5-3914-4696-81e3-91d3549c0f10.png`;
const PROGRESS_RED = `${GPLT}/team-assets/bc20a93b-d4e1-4f68-b3e6-e05546fbbaa2.png`;
const PROGRESS_CIRCLE = `${GPLT}/team-assets/f23bd2d9-a27b-41b6-9b74-4688e7c0d437.png`;

function TeamPipes({ team }: { team: Team }) {
  const maxBasic = 1000;
  const maxAdvanced = 1000;
  const maxTop = 900;

  const pct1 = Math.min((team.basicTotal / maxBasic) * 100, 100);
  const pct2 = team.advancedTotal > 0
    ? Math.min((team.advancedTotal / maxAdvanced) * 100, 100)
    : 0;
  const pct3 = team.topTotal > 0
    ? Math.min((team.topTotal / maxTop) * 100, 100)
    : 0;

  const node1Class = team.advancedUnlocked ? "node1_q5IIb" : "node_D8RD8";
  const node2Class = team.topUnlocked ? "node2_X2JzO" : "node_D8RD8";

  const pipe2Class = `progress_JU3mj${team.advancedUnlocked ? "" : " progressLocked_GRAY"}`;
  const pipe3Class = `progress_JU3mj${team.topUnlocked ? "" : " progressLocked_GRAY"}`;

  const tip2 = team.advancedUnlocked
    ? `${team.advancedTotal} / ${maxAdvanced}`
    : `${team.advancedTotal} / ${maxAdvanced}（未达基础门槛 800，进阶分无效）`;
  const tip3 = team.topUnlocked
    ? `${team.topTotal} / ${maxTop}`
    : `${team.topTotal} / ${maxTop}（未达进阶门槛 400，登顶分无效）`;

  type BallLevel = "top" | "advanced" | "basic" | null;
  const ballLevel: BallLevel = team.topUnlocked && team.topTotal > 0
    ? "top"
    : team.advancedUnlocked && team.advancedTotal > 0
    ? "advanced"
    : team.basicTotal > 0
    ? "basic"
    : null;
  const ballPct =
    ballLevel === "top" ? pct3
    : ballLevel === "advanced" ? pct2
    : ballLevel === "basic" ? pct1
    : 0;

  const circleColorClass =
    ballLevel === "top" ? "circle-red"
    : ballLevel === "advanced" ? "circle-yellow"
    : "circle-blue";

  return (
    <div className="pipes_JC6Fa">
      <div className="head_FBonr">
        <div className="pc-image min-w-0 items-center justify-center inline-flex logo_WqHLc">
          <img src="/gplt/logo-ncwu.png" alt="校徽" />
        </div>
      </div>
      <div className="pipe_QQ5UZ">
        <span className="name_UpmfW">{team.name}</span>
        <img
          src={PROGRESS_BLUE}
          className="progress_JU3mj"
          title={`${team.basicTotal} / ${maxBasic}`}
          alt=""
          style={{ width: `${pct1}%` }}
        />
        {ballLevel === "basic" && (
          <img
            src={PROGRESS_CIRCLE}
            className={`circle_dkyqW ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
        <div className="badges_S9eE3" />
      </div>
      <div className={node1Class} />
      <div className="pipe_QQ5UZ">
        <img
          src={PROGRESS_YELLOW}
          className={pipe2Class}
          title={tip2}
          alt=""
          style={{ width: `${pct2}%` }}
        />
        {ballLevel === "advanced" && (
          <img
            src={PROGRESS_CIRCLE}
            className={`circle_dkyqW ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
        <div className="badges2_uxJ8K" />
      </div>
      <div className={node2Class} />
      <div className="pipe_QQ5UZ">
        <img
          src={PROGRESS_RED}
          className={pipe3Class}
          title={tip3}
          alt=""
          style={{ width: `${pct3}%` }}
        />
        {ballLevel === "top" && (
          <img
            src={PROGRESS_CIRCLE}
            className={`circle_dkyqW ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
        <div className="badges2_uxJ8K" />
      </div>
      <div className="tail_c7ta0" />
    </div>
  );
}

function TeamRow({ team, rank }: { team: Team; rank: number }) {
  const { state, dispatch } = useScore();
  const isSelected = state.selectedTeamId === team.id;
  const flash = useScoreAnimation(team.totalScore);

  return (
    <div
      className={`teamListItem_qeRUr ${isSelected ? "gplt-selected" : ""} ${flash ? "gplt-flash" : ""}`}
      onClick={() => dispatch({ type: "SELECT_TEAM", teamId: team.id })}
    >
      <div className="badge_e77kz">
        <p className="gpltNumber_n12aB">{rank}</p>
      </div>
      <TeamPipes team={team} />
      <div className="score_lqSzX">
        <p className="gpltNumber_n12aB">{team.totalScore}</p>
      </div>
    </div>
  );
}

export function GpltTeamRank() {
  const { state } = useScore();
  const teams = useMemo(() => state.teams, [state.teams]);

  return (
    <>
      <div className="title_Pdg00">
        <h1 id="team-rank" className="anchorTitle_jVGN2">
          <a href="#team-rank">团队排名</a>
        </h1>
        <p className="counter_YbA0b">
          共 {teams.length} 支团队
        </p>
      </div>
      <div className="teamList_sy21T">
        {teams.map((team, idx) => (
          <TeamRow key={team.id} team={team} rank={idx + 1} />
        ))}
        {teams.length === 0 && (
          <div className="empty_mnFop">
            <p>暂无队伍数据</p>
          </div>
        )}
      </div>
    </>
  );
}
