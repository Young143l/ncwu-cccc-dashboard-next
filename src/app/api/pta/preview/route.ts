import { NextRequest, NextResponse } from "next/server";
import { fetchPtaAllRankings } from "@/lib/pta-scraper";

export async function POST(req: NextRequest) {
  const { contestId, cookie } = await req.json();

  if (!contestId || !cookie) {
    return NextResponse.json(
      { error: "缺少 PTA 比赛 ID 或 Cookie" },
      { status: 400 }
    );
  }

  try {
    const [problemsRes, rankingsRes] = await Promise.all([
      fetch(`https://pintia.cn/api/problem-sets/${contestId}/exam-problem-types`, {
        headers: { Accept: "application/json", Cookie: cookie },
      }),
      fetch(`https://pintia.cn/api/problem-sets/${contestId}/exams`, {
        headers: { Accept: "application/json", Cookie: cookie },
      }),
    ]);

    if (!problemsRes.ok || !rankingsRes.ok) {
      return NextResponse.json(
        { error: "无法从 PTA 获取比赛信息，请检查 ID 和 Cookie 是否有效" },
        { status: 400 }
      );
    }

    const problemsData = await problemsRes.json();
    const examData = await rankingsRes.json();

    const name = examData.problemSet?.name || `比赛 ${contestId}`;
    const startAt = examData.problemSet?.startAt || null;
    const endAt = examData.problemSet?.endAt || null;
    const durationMinutes = startAt && endAt
      ? Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
      : 180;

    const problemLabels = problemsData.labels || [];
    const problemCount = problemLabels.length;

    const rankings = await fetchPtaAllRankings(contestId, cookie);
    const participants: Array<{ name: string }> = [];

    for (const entry of rankings.commonRankings) {
      const studentUser = rankings.studentUserById?.[entry.user.studentUserId];
      const displayName = studentUser?.name?.trim()
        || rankings.userById[entry.user.userId]?.nickname?.trim()
        || "未知";
      if (displayName !== "未知" && !participants.some(p => p.name === displayName)) {
        participants.push({ name: displayName });
      }
    }

    return NextResponse.json({
      name,
      startAt,
      endAt,
      durationMinutes,
      problemCount,
      participants,
    });
  } catch {
    return NextResponse.json(
      { error: "获取 PTA 信息失败，请检查网络连接" },
      { status: 500 }
    );
  }
}
