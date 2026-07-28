import { NextResponse } from "next/server";

import { getSession } from "@/lib/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "인증이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, authenticated: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
