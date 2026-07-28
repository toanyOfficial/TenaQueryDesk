import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ ok: false, errorCode: "AUTHENTICATION", error: "인증이 필요합니다." }, { status: 401 });
  const connectionId = Number((await context.params).id);
  if (!Number.isSafeInteger(connectionId) || connectionId < 1) return NextResponse.json({ ok: false, errorCode: "INVALID_CONNECTION", error: "대상 DB 연결 ID를 확인해 주세요." }, { status: 400 });
  // Step 4의 활성 connection repository/pool이 제공되기 전에는 클라이언트 입력으로
  // 접속정보를 받거나 관리 DB 구조를 추측하지 않는다.
  return NextResponse.json({ ok: false, errorCode: "CONNECTION_REPOSITORY_UNAVAILABLE", error: "대상 DB 권한을 확인할 연결 모듈이 아직 구성되지 않았습니다." }, { status: 503 });
}
