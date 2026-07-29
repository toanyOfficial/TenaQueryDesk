import { auditAgent } from "./audit";
import { DEFAULT_AGENT_LIMITS, type AgentLimits } from "./limits";
import { AGENT_SYSTEM_PROMPT, FINALIZATION_PROMPT } from "./system-prompt";
import { executeToolCall } from "./tool-executor";
import { createInitialToolRegistry } from "./initial-tools";
import type { AgentMessage, AgentModelClient, RunAgentInput, RunAgentResult } from "./types";
import { OpenAiOperationError } from "@/lib/server/openai/errors";

function finalResponse(value:unknown):{answer:string;sql:string|null;warnings:string[]}{if(!value||typeof value!=="object")throw new OpenAiOperationError("response_invalid");const item=value as Record<string,unknown>;if(typeof item.answer!=="string"||!item.answer.trim()||item.answer.length>10_000||!(item.sql===null||(typeof item.sql==="string"&&item.sql.length<=50_000))||!Array.isArray(item.warnings)||item.warnings.some(x=>typeof x!=="string"))throw new OpenAiOperationError("response_invalid");return {answer:item.answer.trim(),sql:typeof item.sql==="string"?item.sql.trim():null,warnings:(item.warnings as string[]).map(x=>x.trim()).filter(Boolean)};}
export async function runAgent(input:RunAgentInput,dependencies?:Readonly<{client?:AgentModelClient;limits?:AgentLimits}>):Promise<RunAgentResult>{
  const limits=dependencies?.limits??DEFAULT_AGENT_LIMITS,client=dependencies?.client??(await import("@/lib/server/openai/agent-client")).openAiAgentClient,registry=createInitialToolRegistry(),started=Date.now();
  if(!input.userMessage.trim()||input.userMessage.length>limits.maxUserMessageCharacters)throw new Error("질문은 1자 이상 5,000자 이하로 입력해 주세요.");
  const messages:AgentMessage[]=[{role:"system",content:AGENT_SYSTEM_PROMPT},...(input.previousMessages??[]).slice(-limits.maxPreviousMessages),{role:"user",content:input.userMessage.trim()}],toolsUsed:Array<{name:string;ok:boolean;durationMs:number}>=[];
  let toolCalls=0,consecutive=0,lastTool:string|null=null,iterations=0,limitReached=false;
  auditAgent({event:"run_started",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId});
  while(iterations<limits.maxIterations&&Date.now()-started<limits.requestTimeoutMs){
    iterations++; let turn; try{turn=await client.complete(messages,registry.toOpenAiTools());auditAgent({event:"model_succeeded",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId});}catch(error){auditAgent({event:"model_failed",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId,ok:false});throw error;}
    if(turn.type==="final"){const result=finalResponse(turn.value);auditAgent({event:"run_finished",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId,ok:true,durationMs:Date.now()-started});return {...result,toolsUsed,conversationId:input.conversationId,metadata:{iterations,completedReason:"final_answer"}};}
    if(!turn.calls.length)throw new OpenAiOperationError("response_invalid");
    messages.push({role:"assistant",content:null,toolCalls:turn.calls});
    for(const call of turn.calls){
      consecutive=call.name===lastTool?consecutive+1:1;lastTool=call.name;
      if(toolCalls>=limits.maxToolCalls||consecutive>limits.maxConsecutiveSameTool){limitReached=true;const blocked={ok:false,tool:call.name,error:{code:"AGENT_LIMIT_REACHED",message:"도구 호출 제한에 도달했습니다.",retryable:false},meta:{durationMs:0}} as const;toolsUsed.push({name:call.name,ok:false,durationMs:0});messages.push({role:"tool",toolCallId:call.id,content:JSON.stringify(blocked)});continue;} toolCalls++;
      const result=await executeToolCall(registry,call,{userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId,connection:input.connection});toolsUsed.push({name:call.name,ok:result.ok,durationMs:result.meta.durationMs});messages.push({role:"tool",toolCallId:call.id,content:JSON.stringify(result)});
    }
    if(limitReached)break;
  }
  limitReached=true;auditAgent({event:"limit_reached",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId});messages.push({role:"system",content:FINALIZATION_PROMPT});
  const final=await client.complete(messages,[],{forceFinal:true});if(final.type!=="final")throw new OpenAiOperationError("response_invalid");const result=finalResponse(final.value);auditAgent({event:"run_finished",userId:input.userId,conversationId:input.conversationId,connectionId:input.connectionId,ok:true,durationMs:Date.now()-started});return {...result,warnings:[...result.warnings,"도구 호출 제한에 도달하여 확인된 정보만으로 답변했습니다."],toolsUsed,conversationId:input.conversationId,metadata:{iterations,completedReason:"limit_reached"}};
}
