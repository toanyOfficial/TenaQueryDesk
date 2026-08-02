import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getKnowledge } from "@/lib/server/business-knowledge/business-knowledge-repository";
import { updateBusinessKnowledge } from "@/lib/server/business-knowledge/business-knowledge-service";
import { BusinessKnowledgeError } from "@/lib/server/business-knowledge/business-knowledge-types";
import {assertSameOrigin,getAuthenticatedSecurityActor,securityErrorResponse} from "@/lib/server/security/request-security";
import {authorizeApiAction} from "@/lib/server/security/authorization-service";
import {SecurityError} from "@/lib/server/security/security-errors";
import {getFeatureFlags} from "@/lib/server/features/feature-flags";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const connectionId = Number(new URL(request.url).searchParams.get("connectionId"));
  try { return NextResponse.json({ ok: true, item: await getKnowledge((await context.params).id, connectionId, false) }); }
  catch (error) { return safeError(error); }
}
export async function PUT(request: Request, context: Context) {
  if(!getFeatureFlags().businessKnowledgeManagement)return NextResponse.json({ok:false,errorCode:"FEATURE_DISABLED",error:"업무 지식 관리 기능이 비활성화되어 있습니다."},{status:503});
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  try { assertSameOrigin(request);const id=(await context.params).id,actor=await getAuthenticatedSecurityActor();await authorizeApiAction({actor,resourceType:"business_knowledge",resourceId:id,action:"update"});const body = await request.json() as { version?: unknown; definition?: unknown }; if (!Number.isSafeInteger(body.version)) throw new Error("버전을 확인해 주세요."); const item = await updateBusinessKnowledge(id, body.definition, body.version as number, "shared-admin"); return NextResponse.json({ ok: true, item }); }
  catch (error) { return safeError(error); }
}
function safeError(error: unknown) {
  if(error instanceof SecurityError)return securityErrorResponse(error,NextResponse); if (error instanceof BusinessKnowledgeError) return NextResponse.json({ ok: false, errorCode: error.code, error: error.message }, { status: error.code === "BUSINESS_KNOWLEDGE_NOT_FOUND" ? 404 : error.code.includes("CONFLICT") ? 409 : 400 }); return NextResponse.json({ ok: false, error: "업무 지식을 처리하지 못했습니다." }, { status: 400 }); }
