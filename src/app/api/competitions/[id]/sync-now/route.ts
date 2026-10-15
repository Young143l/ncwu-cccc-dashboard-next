import { NextRequest, NextResponse } from "next/server";
import { syncOnce } from "@/lib/pta-sync";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);

  try {
    const count = await syncOnce(compId);
    return NextResponse.json({ success: true, updatedMembers: count });
  } catch (err) {
    console.error(`[sync-now] competition ${compId} failed:`, err);
    return NextResponse.json(
      { error: "同步失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
