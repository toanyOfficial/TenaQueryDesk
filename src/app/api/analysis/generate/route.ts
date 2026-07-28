import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { connectionId, prompt } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(connectionId) || (connectionId as number) < 1 || typeof prompt !== "string" || prompt.trim().length < 2 || prompt.trim().length > 5_000) return NextResponse.json({ ok: false, error: "대상 DB와 질문을 확인해 주세요." }, { status: 400 });
  // db_connection 및 schema_snapshot의 실제 컬럼을 확인할 schema.md가 제공되기 전에는
  // 활성 연결과 최신 성공 snapshot을 추측하거나 우회하지 않습니다.
  return NextResponse.json({ ok: false, error: "최신 성공 스키마 조회 기능이 아직 구성되지 않았습니다." }, { status: 503 });
}
