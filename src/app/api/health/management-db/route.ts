import { NextResponse } from "next/server";

import { checkManagementDbConnection } from "@/lib/server/db/management-db";

export const dynamic = "force-dynamic";

const SERVICE_NAME = "management-db" as const;

export async function GET() {
  try {
    await checkManagementDbConnection();

    return NextResponse.json(
      { ok: true, service: SERVICE_NAME },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: SERVICE_NAME,
        error: "관리 DB 연결에 실패했습니다.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
