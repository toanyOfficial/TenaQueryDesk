import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { allMessages, getOwnedConversation, getWorkingState } from "@/lib/server/conversation/conversation-repository";
import { ConversationError } from "@/lib/server/conversation/conversation-types";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  const id=(await context.params).id;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({ok:false,error:"대화 ID가 올바르지 않습니다."},{status:400});try{const conversation=await getOwnedConversation(id,"shared-user"),messages=await allMessages(id,"shared-user"),state=await getWorkingState(id);return NextResponse.json({ok:true,item:{id,connectionId:conversation.connectionId,title:conversation.title,status:conversation.status,createdAt:conversation.createdAt,lastActivityAt:conversation.lastActivityAt,messages,workingState:state}});}catch(error){if(error instanceof ConversationError)return NextResponse.json({ok:false,error:error.message,errorCode:error.code},{status:error.code==="CONVERSATION_NOT_FOUND"?404:403});throw error;}
}
