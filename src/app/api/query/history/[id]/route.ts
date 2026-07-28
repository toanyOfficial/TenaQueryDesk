import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "실행 이력 ID를 확인해 주세요." }, { status: 400 });
  return NextResponse.json({ ok: false, error: "실행 이력 저장소가 아직 구성되지 않았습니다." }, { status: 503 });
}
