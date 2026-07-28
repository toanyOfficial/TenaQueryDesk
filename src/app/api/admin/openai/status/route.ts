import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { inspectOpenAiConfig } from "@/lib/server/openai/config";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const status=inspectOpenAiConfig();
  return NextResponse.json({ ok:true,configured:status.configured,model:status.model,timeoutMs:status.requestTimeoutMs,maxOutputTokens:status.maxOutputTokens,maxRetries:status.maxRetries,issues:status.issues,lastRequest:null },{headers:{"Cache-Control":"no-store"}});
}
