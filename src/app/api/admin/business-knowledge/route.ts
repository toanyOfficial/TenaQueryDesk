import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { createBusinessKnowledge, listBusinessKnowledge } from "@/lib/server/business-knowledge/business-knowledge-service";
import { BusinessKnowledgeError, KNOWLEDGE_STATUSES, KNOWLEDGE_TYPES } from "@/lib/server/business-knowledge/business-knowledge-types";
import {assertSameOrigin,getAuthenticatedSecurityActor,securityErrorResponse} from "@/lib/server/security/request-security";
import {authorizeApiAction} from "@/lib/server/security/authorization-service";
import {SecurityError} from "@/lib/server/security/security-errors";
import {getFeatureFlags} from "@/lib/server/features/feature-flags";

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const connectionId = Number(params.get("connectionId"));
  const type = params.get("type") || undefined, status = params.get("status") || undefined;
  if (!Number.isSafeInteger(connectionId) || connectionId < 1 || (type && !(KNOWLEDGE_TYPES as readonly string[]).includes(type)) || (status && !(KNOWLEDGE_STATUSES as readonly string[]).includes(status))) return NextResponse.json({ ok: false, error: "조회 조건이 올바르지 않습니다." }, { status: 400 });
  const items = await listBusinessKnowledge({ connectionId, query: params.get("query") || undefined, type: type as never, status: status as never, limit: 100 });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  if(!getFeatureFlags().businessKnowledgeManagement)return NextResponse.json({ok:false,errorCode:"FEATURE_DISABLED",error:"업무 지식 관리 기능이 비활성화되어 있습니다."},{status:503});
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  try { assertSameOrigin(request);const actor=await getAuthenticatedSecurityActor();await authorizeApiAction({actor,resourceType:"business_knowledge",resourceId:"*",action:"create"});const item = await createBusinessKnowledge(await request.json(), "shared-admin"); return NextResponse.json({ ok: true, item }, { status: 201 }); }
  catch (error) { return safeError(error); }
}

function safeError(error: unknown) {
  if(error instanceof SecurityError)return securityErrorResponse(error,NextResponse);
  if (error instanceof BusinessKnowledgeError) return NextResponse.json({ ok: false, errorCode: error.code, error: error.message }, { status: error.code.includes("CONFLICT") || error.code.includes("DUPLICATED") ? 409 : 400 });
  return NextResponse.json({ ok: false, error: "업무 지식 요청을 처리하지 못했습니다." }, { status: 400 });
}
