import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getQueryEnvironment } from "@/lib/server/env";
import { validateSelectQuery } from "@/lib/server/sql/validate-select-query";

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, errorType: "authentication", error: "인증이 필요합니다." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ ok: false, errorType: "validation", error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, errorType: "validation", error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { connectionId, sql, analysisHistoryId } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(connectionId) || (connectionId as number) < 1 || !(analysisHistoryId === null || analysisHistoryId === undefined || (Number.isSafeInteger(analysisHistoryId) && (analysisHistoryId as number) > 0))) return NextResponse.json({ ok: false, errorType: "validation", error: "실행 요청 정보를 확인해 주세요." }, { status: 400 });
  const policy = getQueryEnvironment();
  // 실제 database name은 활성 대상 DB repository에서만 가져와야 합니다. 선행 모듈이 없는
  // 현재 상태에서는 qualified table을 허용하지 않고 구조 검증만 수행합니다.
  const validation = validateSelectQuery(sql, "__unresolved_database__", policy.maxRows, policy.maxSqlLength);
  if (!validation.valid) return NextResponse.json({ ok: false, errorType: "validation", error: validation.errorMessage }, { status: 400 });
  return NextResponse.json({ ok: false, errorType: "connection", error: "대상 DB 실행 연결이 아직 구성되지 않았습니다." }, { status: 503 });
}
