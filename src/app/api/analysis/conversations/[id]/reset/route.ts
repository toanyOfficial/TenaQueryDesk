import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth/session";
import {resetConversation} from "@/lib/server/conversation/conversation-service";
import {ConversationError} from "@/lib/server/conversation/conversation-types";
type Context={params:Promise<{id:string}>};
export async function POST(_request:Request,context:Context){if(!(await getSession()))return NextResponse.json({ok:false,error:"인증이 필요합니다."},{status:401});const id=(await context.params).id;try{await resetConversation("shared-user",id);return NextResponse.json({ok:true});}catch(error){if(error instanceof ConversationError)return NextResponse.json({ok:false,error:error.message,errorCode:error.code},{status:400});return NextResponse.json({ok:false,error:"대화를 초기화하지 못했습니다."},{status:500});}}
