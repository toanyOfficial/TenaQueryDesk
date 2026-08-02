import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import { collectMysqlSchema } from "@/lib/server/schema/collect-mysql-schema";
import { listBusinessKnowledge, validateStoredKnowledge } from "@/lib/server/business-knowledge/business-knowledge-service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const id = Number((await params).id), connection = await getTargetConnection(id);
  if (!connection) return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
  let result;
  try { result = await collectMysqlSchema(connection); }
  catch { return NextResponse.json({ error: "스키마 파일 생성에 실패했습니다. metadata 조회 권한을 확인해 주세요." }, { status: 502 }); }
  try {
    const active = await listBusinessKnowledge({ connectionId: id, status: "active", limit: 100 });
    const validations = await Promise.all(active.map(async (entry) => ({ id: entry.id, validation: await validateStoredKnowledge(entry.id, id, true) })));
    return NextResponse.json({ ok: true, result, businessKnowledgeValidation: { checked: validations.length, invalid: validations.filter((item) => !item.validation.valid).map((item) => item.id) } });
  } catch {
    return NextResponse.json({ ok: true, result, businessKnowledgeValidation: { checked: 0, invalid: [], warning: "스키마는 생성했지만 업무 지식 재검증을 완료하지 못했습니다." } });
  }
}
