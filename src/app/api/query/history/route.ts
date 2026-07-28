import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const connectionId = Number(params.get("connectionId"));
  const limit = params.has("limit") ? Number(params.get("limit")) : DEFAULT_LIMIT;
  if (!Number.isSafeInteger(connectionId) || connectionId < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) return NextResponse.json({ ok: false, error: "조회 조건을 확인해 주세요." }, { status: 400 });
  return NextResponse.json({ ok: false, error: "실행 이력 저장소가 아직 구성되지 않았습니다." }, { status: 503 });
}
