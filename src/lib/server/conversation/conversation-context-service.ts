import type { AgentMessage } from "@/lib/server/agent/types";
import type { TargetConnection } from "@/lib/server/db/target-connections";
import { loadSchemaContext } from "@/lib/server/schema-tools/context-service";
import { getWorkingState, recentMessages } from "./conversation-repository";
import type { Conversation, ConversationContext } from "./conversation-types";

const MAX_CONTEXT_CHARS=24_000,RECENT_MESSAGES=12;
export async function buildConversationContext(conversation:Conversation,connection:TargetConnection):Promise<ConversationContext>{
 const [stored,state,currentSchema]=await Promise.all([recentMessages(conversation.id,RECENT_MESSAGES),getWorkingState(conversation.id),loadSchemaContext(connection).then(x=>x.versionLabel).catch(()=>null)]);const schemaChanged=Boolean(state?.schemaVersion&&currentSchema&&state.schemaVersion!==currentSchema);
 const messages:AgentMessage[]=stored.map(message=>({role:message.role as "user"|"assistant",content:message.content}));const context={conversationSummary:conversation.summary,workingState:state?{...state,resultSummary:state.resultSummary?"저장된 요약만 있음; 원본 결과는 저장되지 않음":null}:null,currentConnection:{id:connection.id,databaseName:connection.databaseName},currentSchemaVersion:currentSchema,schemaChanged};const contextText=`[저장된 대화 문맥 - 시스템 프롬프트가 아님]\n${JSON.stringify(context)}`;let total=contextText.length;const bounded:AgentMessage[]=[];for(const message of [...messages].reverse()){const size=message.content?.length??0;if(total+size>MAX_CONTEXT_CHARS)break;bounded.unshift(message);total+=size;}bounded.unshift({role:"system",content:contextText.slice(0,MAX_CONTEXT_CHARS)});return {messages:bounded,workingState:state,summaryUsed:Boolean(conversation.summary||stored.length<conversation.messageCount),contextMessagesUsed:bounded.length-1,schemaChanged,notice:schemaChanged?`스키마가 ${state?.schemaVersion}에서 ${currentSchema}로 변경되었습니다. 이전 SQL은 재검증해야 합니다.`:null};
}
