import { NextResponse } from "next/server";

import { getRuntimeInfo } from "@/lib/server/runtime-info";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "tena-query-desk",
      runtime: getRuntimeInfo(),
      build: { commit: null, buildTime: null },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
