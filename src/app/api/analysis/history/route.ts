import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const search = new URL(request.url).searchParams;
  const connectionId = Number(search.get("connectionId"));
  const limit = search.has("limit") ? Number(search.get("limit")) : DEFAULT_LIMIT;
  if (!Number.isSafeInteger(connectionId) || connectionId < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) return NextResponse.json({ ok: false, error: "조회 조건이 올바르지 않습니다." }, { status: 400 });
  return NextResponse.json({ ok: false, error: "GPT 질의 이력 저장소가 아직 구성되지 않았습니다." }, { status: 503 });
}
