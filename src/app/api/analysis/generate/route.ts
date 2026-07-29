import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { inspectOpenAiConfig } from "@/lib/server/openai/config";
import { OpenAiOperationError } from "@/lib/server/openai/errors";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import { loadCurrentSchemaBundle } from "@/lib/server/schema/select-schema";
import { generateQueryFromSchema } from "@/lib/server/openai/generate-query";

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { connectionId, prompt } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(connectionId) || (connectionId as number) < 1 || typeof prompt !== "string" || prompt.trim().length < 2 || prompt.trim().length > 5_000) return NextResponse.json({ ok: false, error: "대상 DB와 질문을 확인해 주세요." }, { status: 400 });
  if (!inspectOpenAiConfig().configured) {
    const error=new OpenAiOperationError("config_missing");
    return NextResponse.json({ ok:false,analysisHistoryId:null,errorCode:error.code,error:error.message },{status:503});
  }
  const target=await getTargetConnection(connectionId as number);
  if(!target || !target.active) return NextResponse.json({ok:false,analysisHistoryId:null,error:"활성 대상 DB 연결을 찾을 수 없습니다."},{status:404});
  try {
    const bundle=await loadCurrentSchemaBundle(target.connectionKey);
    const generated=await generateQueryFromSchema(target.id,prompt.trim(),bundle);
    return NextResponse.json({ok:true,analysisHistoryId:null,historyWarning:"질문 이력 저장 기능은 아직 구성되지 않았습니다.",result:generated.result});
  } catch (error) {
    if(error instanceof OpenAiOperationError) return NextResponse.json({ok:false,analysisHistoryId:null,errorCode:error.code,error:error.message},{status:error.retryable?503:502});
    const message=error instanceof Error && error.message.includes("관련된 스키마") ? error.message : "생성된 최신 스키마 파일을 불러오지 못했습니다. 관리 화면에서 스키마 파일을 다시 생성해 주세요.";
    return NextResponse.json({ok:false,analysisHistoryId:null,error:message},{status:422});
  }
}
