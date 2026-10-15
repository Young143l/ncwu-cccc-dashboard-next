import { NextRequest, NextResponse } from "next/server";
import { getPtaSyncStatus } from "@/lib/pta-sync";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const compId = parseInt(id);

  return NextResponse.json({
    competitionId: compId,
    ...getPtaSyncStatus(compId),
  });
}
