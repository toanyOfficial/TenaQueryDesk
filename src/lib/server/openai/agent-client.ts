import "server-only";
import { getOpenAiRuntimeConfig } from "./config";
import { classifyOpenAiHttpError, OpenAiOperationError, toOpenAiError } from "./errors";
import type { AgentMessage, AgentModelClient, AgentModelTurn, OpenAiTool } from "@/lib/server/agent/types";

const ENDPOINT="https://api.openai.com/v1/chat/completions";
const FINAL_SCHEMA={name:"agent_final_response",strict:true,schema:{type:"object",additionalProperties:false,required:["answer","sql","warnings"],properties:{answer:{type:"string"},sql:{type:["string","null"]},warnings:{type:"array",items:{type:"string"}}}}} as const;
function wireMessage(message:AgentMessage):Record<string,unknown>{
  if(message.role==="tool") return {role:"tool",tool_call_id:message.toolCallId,content:message.content};
  if(message.role==="assistant"&&message.toolCalls) return {role:"assistant",content:message.content,tool_calls:message.toolCalls.map(call=>({id:call.id,type:"function",function:{name:call.name,arguments:call.arguments}}))};
  return {role:message.role,content:message.content};
}
export const openAiAgentClient:AgentModelClient={async complete(messages,tools,options):Promise<AgentModelTurn>{
  const config=getOpenAiRuntimeConfig(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),config.requestTimeoutMs);
  try {
    const body:Record<string,unknown>={model:config.model,messages:messages.map(wireMessage),response_format:{type:"json_schema",json_schema:FINAL_SCHEMA},max_completion_tokens:config.maxOutputTokens};
    if(!options?.forceFinal) body.tools=tools;
    const response=await fetch(ENDPOINT,{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const payload=await response.json().catch(()=>null) as {choices?:Array<{finish_reason?:string;message?:{content?:string|null;refusal?:string|null;tool_calls?:Array<{id?:string;type?:string;function?:{name?:string;arguments?:string}}>}}>}|null;
    if(!response.ok) throw classifyOpenAiHttpError(response.status,payload);
    const message=payload?.choices?.[0]?.message;
    if(message?.refusal) throw new OpenAiOperationError("safety_refusal");
    if(message?.tool_calls?.length){const calls=message.tool_calls.map(call=>({id:call.id??"",name:call.function?.name??"",arguments:call.function?.arguments??""}));if(calls.some(call=>!call.id||!call.name))throw new OpenAiOperationError("response_invalid");return {type:"tool_calls",calls};}
    if(!message?.content) throw new OpenAiOperationError("response_invalid");
    try{return {type:"final",value:JSON.parse(message.content)}}catch{throw new OpenAiOperationError("response_invalid")}
  }catch(error){throw toOpenAiError(error)}finally{clearTimeout(timer)}
}};
export function openAiTools(tools:ReadonlyArray<OpenAiTool>):ReadonlyArray<OpenAiTool>{return tools;}
