"use client";

import { useMemo } from "react";
import { useScore } from "@/context/score-context";
import { useScoreAnimation } from "@/hooks/use-score-animation";
import type { Member } from "@/types";

const GPLT = "/gplt";
const PROGRESS_BLUE = `${GPLT}/student-assets/3079c545-5b3e-4bc9-8e01-71d42490b25c.png`;
const PROGRESS_YELLOW = `${GPLT}/student-assets/0394fbe5-3914-4696-81e3-91d3549c0f10.png`;
const PROGRESS_RED = `${GPLT}/student-assets/bc20a93b-d4e1-4f68-b3e6-e05546fbbaa2.png`;
const PROGRESS_CIRCLE = `${GPLT}/student-assets/f23bd2d9-a27b-41b6-9b74-4688e7c0d437.png`;

interface RankedMember {
  member: Member;
  teamId: string;
  teamName: string;
  rank: number;
}

function PersonPipes({
  member,
  teamName,
}: {
  member: Member;
  teamName: string;
}) {
  const maxBasic = 100;
  const maxAdvanced = 100;
  const maxTop = 90;

  const advUnlocked = member.advancedUnlocked;
  const topUnlocked = member.topUnlocked;

  const pct1 = Math.min((member.basicTotal / maxBasic) * 100, 100);
  const pct2 =
    member.advancedTotal > 0
      ? Math.min((member.advancedTotal / maxAdvanced) * 100, 100)
      : 0;
  const pct3 =
    member.topTotal > 0
      ? Math.min((member.topTotal / maxTop) * 100, 100)
      : 0;

  const node1Class = advUnlocked ? "node1_P5XVN" : "node_JIp6m";
  const node2Class = topUnlocked ? "node2_zRkMT" : "node_JIp6m";

  const pipe2Class = `progress_zTSqP${advUnlocked ? "" : " progressLocked_GRAY"}`;
  const pipe3Class = `progress_zTSqP${topUnlocked ? "" : " progressLocked_GRAY"}`;

  const tip2 = advUnlocked
    ? `${member.advancedTotal} / ${maxAdvanced}`
    : `${member.advancedTotal} / ${maxAdvanced}（未达基础门槛 80，进阶分无效）`;
  const tip3 = topUnlocked
    ? `${member.topTotal} / ${maxTop}`
    : `${member.topTotal} / ${maxTop}（未达进阶门槛 40，登顶分无效）`;

  type BallLevel = "top" | "advanced" | "basic" | null;
  const ballLevel: BallLevel =
    topUnlocked && member.topTotal > 0
      ? "top"
      : advUnlocked && member.advancedTotal > 0
      ? "advanced"
      : member.basicTotal > 0
      ? "basic"
      : null;
  const ballPct =
    ballLevel === "top"
      ? pct3
      : ballLevel === "advanced"
      ? pct2
      : ballLevel === "basic"
      ? pct1
      : 0;
  const ballClass = ballPct >= 100 ? "circleFull_Kp4vJ" : "circle_FXZIg";

  const circleColorClass =
    ballLevel === "top"
      ? "circle-red"
      : ballLevel === "advanced"
      ? "circle-yellow"
      : "circle-blue";

  return (
    <div className="pipes_IXOBJ">
      <div className="head_MtmVb">
        <div className="pc-image min-w-0 items-center justify-center inline-flex logo_bPOkW">
          <img src="/gplt/logo-ncwu.png" alt="校徽" />
        </div>
      </div>
      <div className="pipe_DLbm3">
        <span className="name_ETm8P">
          {member.name} - {teamName}
        </span>
        <img
          src={PROGRESS_BLUE}
          className="progress_zTSqP"
          title={`${member.basicTotal} / ${maxBasic}`}
          alt=""
          style={{ width: `${pct1}%` }}
        />
        {ballLevel === "basic" && (
          <img
            src={PROGRESS_CIRCLE}
            className={`${ballClass} ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
      </div>
      <div className={node1Class} />
      <div className="pipe_DLbm3">
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
            className={`${ballClass} ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
        <div className="badges2_bcVll" />
      </div>
      <div className={node2Class} />
      <div className="pipe_DLbm3">
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
            className={`${ballClass} ${circleColorClass}`}
            alt=""
            style={{ left: `${ballPct}%` }}
          />
        )}
        <div className="badges2_bcVll" />
      </div>
      <div className="tail_YUPwI" />
    </div>
  );
}

function PersonRow({
  item,
  rank,
  isSelected,
  onClick,
}: {
  item: RankedMember;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const flash = useScoreAnimation(item.member.totalScore);

  return (
    <div
      className={`studentListItem_LWYA2 ${isSelected ? "gplt-selected" : ""} ${flash ? "gplt-flash" : ""}`}
      onClick={onClick}
    >
      <div className="badge_xcZuC">
        <p className="gpltNumber_x1pEx">{rank}</p>
      </div>
      <PersonPipes member={item.member} teamName={item.teamName} />
      <div className="score_ulq1B">
        <p className="gpltNumber_x1pEx">{item.member.totalScore}</p>
      </div>
    </div>
  );
}

export function GpltIndividualRank() {
  const { state, dispatch } = useScore();

  const rankedMembers: RankedMember[] = useMemo(() => {
    const all: Omit<RankedMember, "rank">[] = [];
    for (const team of state.teams) {
      for (const member of team.members) {
        all.push({ member, teamId: team.id, teamName: team.name });
      }
    }
    all.sort(
      (a, b) =>
        b.member.totalScore - a.member.totalScore ||
        a.member.name.localeCompare(b.member.name)
    );
    return all.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [state.teams]);

  return (
    <>
      <div className="title_Pdg00">
        <h1 id="individual-rank" className="anchorTitle_jVGN2">
          <a href="#individual-rank">个人排名</a>
        </h1>
        <p className="counter_YbA0b">共 {rankedMembers.length} 人</p>
      </div>
      <div style={{ clear: "both" }} />
      <div className="studentList_JpA1T">
        {rankedMembers.map((item) => (
          <PersonRow
            key={item.member.id}
            item={item}
            rank={item.rank}
            isSelected={state.selectedMemberId === item.member.id}
            onClick={() =>
              dispatch({ type: "SELECT_MEMBER", memberId: item.member.id })
            }
          />
        ))}
        {rankedMembers.length === 0 && (
          <div className="empty_rGDZ6">
            <p>暂无队员数据</p>
          </div>
        )}
      </div>
    </>
  );
}
