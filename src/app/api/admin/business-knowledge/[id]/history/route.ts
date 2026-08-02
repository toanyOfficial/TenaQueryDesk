import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getKnowledgeAudit } from "@/lib/server/business-knowledge/business-knowledge-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { if (!(await getSession())) return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 }); return NextResponse.json({ ok: true, items: await getKnowledgeAudit((await context.params).id) }); }
