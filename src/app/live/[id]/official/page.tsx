"use client";

import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { ScoreProvider, useScore } from "@/context/score-context";
import { getCompetition } from "@/services/api";
import { convertDetailToTeams, type CompetitionApiData } from "@/lib/server-utils";
import { useViewportScale } from "@/hooks/use-viewport-scale";
import type { Team } from "@/types";
import { GpltTeamRank } from "@/components/gplt/gplt-team-rank";
import { GpltIndividualRank } from "@/components/gplt/gplt-individual-rank";
import { GpltTeamDetail } from "@/components/gplt/gplt-team-detail";
import { GpltStudentDetail } from "@/components/gplt/gplt-student-detail";
import "@/styles/official.css";

const POLL_INTERVAL_MS = 60_000;

function OfficialPollingUpdater({ competitionId }: { competitionId: number }) {
  const { dispatch } = useScore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await getCompetition(competitionId);
      const teams = convertDetailToTeams(data as unknown as CompetitionApiData);
      dispatch({ type: "BATCH_REPLACE", teams });
    } catch (err) {
      console.error("Poll failed:", err);
    }
  }, [competitionId, dispatch]);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [poll]);

  return null;
}

function OfficialLiveContent({
  compName,
  compId,
}: {
  compName: string;
  compId: number;
}) {
  const [tab, setTab] = useState<"team" | "individual">("team");
  // 官方版式是 1200px 固定宽度，窄屏整体等比缩放（等价于手动缩放）
  const scale = useViewportScale();

  useEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const body = document.body;
    if (root) root.style.overflow = "visible";
    html.style.overflow = "visible";
    body.style.overflow = "visible";
    return () => {
      if (root) root.style.overflow = "";
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="mainContainer_zpZoi"
      style={{ zoom: scale } as React.CSSProperties}
    >
      <OfficialPollingUpdater competitionId={compId} />
      <div className="container_KGMv8">
        <div className="wrapper_Gjsvi">
          <div
            className="shortBody_ELmXF"
            style={{ "--bg-image": "url(/gplt/bg-hero.jpg)" } as React.CSSProperties}
          >
            <img className="left_e69CK" src="/gplt/team-assets/1d4f0bd3-a090-4ed6-8637-12e2394b80c6.png" alt="" />
            <img className="right_RTLWm" src="/gplt/team-assets/5c7372e5-2e3a-4d93-b535-10fa3012649d.png" alt="" />
            <img className="rocket_vlZSI" src="/gplt/team-assets/b103afab-4223-4d34-b3c4-29bae6bbfa7e.png" alt="" />
            <img className="top_gG9x9" src="/gplt/team-assets/58493d75-9ff9-47df-bf0a-1226374fe917.png" alt="" />
            <div className="inner_cEOqe" />
            <img className="ladder_LjuTV" src="/gplt/team-assets/cde5ca70-9633-408f-be36-c154617f8165.png" alt="" />
            <div className="links_xU9fI">
              <a
                className={tab === "team" ? "active_Eu6E1" : ""}
                onClick={() => setTab("team")}
              >
                团队排名
              </a>
              <a
                className={tab === "individual" ? "active_Eu6E1" : ""}
                onClick={() => setTab("individual")}
              >
                个人排名
              </a>
            </div>
            <div className="logo_Srcaz">
              <img src="/gplt/team-assets/620d9910-8b12-4a2d-bb9e-76a640daf0aa.png" alt="logo" />
            </div>
          </div>
        </div>
      </div>

      <div className="wrapper_VkSjg" style={{
        "--bg-image": "url(/gplt/bg-main.jpg)",
        "--planet1-image": "url(/gplt/planet1.png)",
        "--planet2-image": "url(/gplt/planet2.png)",
        "--planet3-image": "url(/gplt/planet3.png)",
        "--stardust-image": "url(/gplt/stardust.png)",
      } as React.CSSProperties}>
        <div className="body_W_vNZ">
          <div className="inner_E9HP3">
            {tab === "team" ? (
              <div className="rankTeamPage_KSGze" style={{
                "--progress-head": "url(/gplt/progress-head.png)",
                "--progress-node1": "url(/gplt/progress-node1.png)",
                "--progress-node2": "url(/gplt/progress-node2.png)",
                "--progress-node3": "url(/gplt/progress-node3.png)",
                "--progress-pipe": "url(/gplt/progress-pipe.png)",
                "--progress-snode1": "url(/gplt/progress-snode1.png)",
                "--progress-snode2": "url(/gplt/progress-snode2.png)",
                "--progress-tail": "url(/gplt/progress-tail.png)",
              } as React.CSSProperties}>
                <GpltTeamRank />
              </div>
            ) : (
              <div className="rankStudentPage_YXwTc" style={{
                "--progress-head": "url(/gplt/progress-head.png)",
                "--progress-node1": "url(/gplt/progress-node1.png)",
                "--progress-node2": "url(/gplt/progress-node2.png)",
                "--progress-node3": "url(/gplt/progress-node3.png)",
                "--progress-pipe": "url(/gplt/progress-pipe.png)",
                "--progress-snode1": "url(/gplt/progress-snode1.png)",
                "--progress-snode2": "url(/gplt/progress-snode2.png)",
                "--progress-tail": "url(/gplt/progress-tail.png)",
              } as React.CSSProperties}>
                <GpltIndividualRank />
              </div>
            )}
          </div>
        </div>
        <img className="rocket_S4f1K" src="/gplt/team-assets/a599e0df-22eb-41a3-87d7-024b03f8c0f3.png" alt="rocket" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <img className="cloudLeft_yLzW1" src="/gplt/team-assets/83f91ff3-68f8-4eb8-b516-2653de53fb52.png" alt="" />
        <img className="cloudRight_a90At" src="/gplt/team-assets/83f91ff3-68f8-4eb8-b516-2653de53fb52.png" alt="" />
      </div>

      <GpltTeamDetail />
      <GpltStudentDetail />

      <div className="footer_AWrq9">
        <div className="container_zgmCz">
          <div className="supports_ZvyYN">
            <h2>支持单位</h2>
            <p className="footerSupportLine_NCWU">
              <img src="/gplt/logo-ncwu.png" alt="校徽" />
              <span>华北水利水电大学</span>
            </p>
          </div>
          <div className="hosts__B8WB">
            <h2>主办单位</h2>
            <p>华北水利水电大学信息工程学院</p>
          </div>
          <div className="rights_HqAXh">
            <h2>版权信息</h2>
            <p>本天梯赛实时大屏对比赛持有最终解释权</p>
          </div>
          <div className="contacts_CWg7b">
            <h2>联系我们</h2>
            <p><a href="mailto:769472984@qq.com">769472984@qq.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfficialLiveScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [compName, setCompName] = useState("");
  const [compId, setCompId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { id: rawId } = await params;
        const id = parseInt(rawId);
        setCompId(id);
        const data = await getCompetition(id);
        setCompName(data.name);
        setTeams(convertDetailToTeams(data as unknown as CompetitionApiData));
      } catch {
        setError("加载比赛数据失败");
      }
    })();
  }, [params]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0d1117",
          color: "#ea4335",
          fontSize: 18,
        }}
      >
        {error}
      </div>
    );
  }

  if (!teams || !compId) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0d1117",
          color: "#7accec",
          fontSize: 18,
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <ScoreProvider initialTeams={teams}>
      <OfficialLiveContent compName={compName} compId={compId} />
    </ScoreProvider>
  );
}
