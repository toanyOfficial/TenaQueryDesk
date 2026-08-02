import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { validateStoredKnowledge } from "@/lib/server/business-knowledge/business-knowledge-service";
import { BusinessKnowledgeError } from "@/lib/server/business-knowledge/business-knowledge-types";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { if (!(await getSession())) return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 }); const connectionId = Number(new URL(request.url).searchParams.get("connectionId")); try { return NextResponse.json({ ok: true, validation: await validateStoredKnowledge((await context.params).id, Number.isSafeInteger(connectionId) ? connectionId : null) }); } catch (error) { if (error instanceof BusinessKnowledgeError) return NextResponse.json({ ok: false, errorCode: error.code, error: error.message }, { status: 400 }); return NextResponse.json({ ok: false, error: "스키마 유효성을 검증하지 못했습니다." }, { status: 500 }); } }
