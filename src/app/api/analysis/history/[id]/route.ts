import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "이력 ID가 올바르지 않습니다." }, { status: 400 });
  return NextResponse.json({ ok: false, error: "GPT 질의 이력 저장소가 아직 구성되지 않았습니다." }, { status: 503 });
}
