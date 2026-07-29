import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { inspectOpenAiConfig } from "@/lib/server/openai/config";
import { OpenAiOperationError } from "@/lib/server/openai/errors";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import { runAgent } from "@/lib/server/agent/orchestrator";

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { connectionId, prompt, conversationId: requestedConversationId } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(connectionId) || (connectionId as number) < 1 || typeof prompt !== "string" || prompt.trim().length < 2 || prompt.trim().length > 5_000) return NextResponse.json({ ok: false, error: "대상 DB와 질문을 확인해 주세요." }, { status: 400 });
  if (requestedConversationId !== undefined && (typeof requestedConversationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedConversationId))) return NextResponse.json({ ok:false,error:"대화 ID 형식이 올바르지 않습니다." },{status:400});
  if (!inspectOpenAiConfig().configured) {
    const error=new OpenAiOperationError("config_missing");
    return NextResponse.json({ ok:false,analysisHistoryId:null,errorCode:error.code,error:error.message },{status:503});
  }
  const target=await getTargetConnection(connectionId as number);
  if(!target || !target.active) return NextResponse.json({ok:false,analysisHistoryId:null,error:"활성 대상 DB 연결을 찾을 수 없습니다."},{status:404});
  try {
    const conversationId=typeof requestedConversationId==="string"?requestedConversationId:crypto.randomUUID();
    const generated=await runAgent({userId:"authenticated-session",connectionId:target.id,conversationId,userMessage:prompt.trim(),connection:target});
    const result={requestType:generated.sql?"select":"schema_explanation",answer:generated.answer,sql:generated.sql,referencedTables:generated.references.tables,assumptions:[],warnings:generated.warnings,riskLevel:"read_only",transactionGuidance:{applicable:false,summary:null},executionPlan:null,conversationId:generated.conversationId,references:generated.references,agent:{iterations:generated.metadata.iterations,toolsUsed:generated.toolsUsed.map(tool=>tool.name),toolUsage:generated.toolsUsed,completedReason:generated.metadata.completedReason}};
    return NextResponse.json({ok:true,analysisHistoryId:null,conversationId,historyWarning:"요청 내 도구 문맥은 유지되지만 요청 간 대화 저장소는 아직 구성되지 않았습니다.",result});
  } catch (error) {
    if(error instanceof OpenAiOperationError) return NextResponse.json({ok:false,analysisHistoryId:null,errorCode:error.code,error:error.message},{status:error.retryable?503:502});
    return NextResponse.json({ok:false,analysisHistoryId:null,error:"Agent 요청을 처리하지 못했습니다."},{status:422});
  }
}
