import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { listConversations } from "@/lib/server/conversation/conversation-repository";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const search = new URL(request.url).searchParams;
  const connectionId = Number(search.get("connectionId"));
  const limit = search.has("limit") ? Number(search.get("limit")) : DEFAULT_LIMIT;
  if (!Number.isSafeInteger(connectionId) || connectionId < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) return NextResponse.json({ ok: false, error: "조회 조건이 올바르지 않습니다." }, { status: 400 });
  const conversations=await listConversations("shared-user",connectionId,limit);return NextResponse.json({ok:true,items:conversations.map(item=>({id:item.id,connectionId:item.connectionId,title:item.title,requestType:"conversation",userPromptPreview:item.lastQuestion??item.title,assistantAnswerPreview:null,hasSql:item.hasSql,executed:item.executed,status:item.status==="active"?"success":"archived",createdAt:item.lastActivityAt,messageCount:item.messageCount}))});
}
