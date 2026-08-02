import { auditAgent } from "./audit";
import type { AgentToolCall, ToolContext, ToolResult } from "./types";
import { ToolRegistry } from "./tool-registry";
import { SchemaToolError } from "@/lib/server/schema-tools/types";
import { KnowledgeError } from "@/lib/server/knowledge/types";
import { GitHubToolError } from "@/lib/server/github-tools/github-tool-types";
import { RuntimeToolError } from "@/lib/server/runtime-tools/runtime-tool-types";
import { auditRuntime } from "@/lib/server/runtime-tools/runtime-audit";

const runtimeToolNames=new Set(["get_runtime_project_context","get_deployment_status","get_process_status","get_port_status","run_project_health_check","get_reverse_proxy_status","get_deployment_report","compare_deployed_commit_with_repository","get_runtime_capabilities"]);
function auditRuntimeTool(context:ToolContext,tool:string,input:unknown,result:ToolResult){if(!runtimeToolNames.has(tool))return;const values=input&&typeof input==="object"?input as Record<string,unknown>:{},data=result.ok&&result.data&&typeof result.data==="object"?result.data as Record<string,unknown>:{};auditRuntime({userId:context.userId,conversationId:context.conversationId,projectId:typeof data.projectId==="string"?data.projectId:typeof values.projectId==="string"?values.projectId:null,serverId:typeof data.serverId==="string"?data.serverId:null,tool,ok:result.ok,durationMs:result.meta.durationMs,deploymentId:typeof data.deploymentId==="string"?data.deploymentId:typeof values.deploymentId==="string"?values.deploymentId:null,commit:typeof data.deployedCommit==="string"?data.deployedCommit:null,truncated:result.ok?result.meta.truncated:undefined,errorCode:result.ok?undefined:result.error.code});}

function validObject(input: unknown, schema: Readonly<Record<string, unknown>>): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value=input as Record<string,unknown>, properties=(schema.properties ?? {}) as Record<string,Record<string,unknown>>, required=(schema.required ?? []) as string[];
  if (required.some(key => !(key in value))) return false;
  if (schema.additionalProperties === false && Object.keys(value).some(key => !(key in properties))) return false;
  return Object.entries(value).every(([key,item]) => { const rule=properties[key]??{},type=rule.type;if(rule.enum&&!(rule.enum as unknown[]).includes(item))return false;if(type === "string"&&(typeof item!=="string"||(typeof rule.minLength==="number"&&item.length<rule.minLength)||(typeof rule.maxLength==="number"&&item.length>rule.maxLength)))return false;if(type === "boolean"&&typeof item!=="boolean")return false;if(type === "number"&&typeof item!=="number")return false;if(type === "integer"&&!Number.isSafeInteger(item))return false;if((type==="number"||type==="integer")&&typeof item==="number"&&((typeof rule.minimum==="number"&&item<rule.minimum)||(typeof rule.maximum==="number"&&item>rule.maximum)))return false;if(type === "object"&&(!item||typeof item!=="object"||Array.isArray(item)))return false;return true; });
}
function redact(value: unknown, sensitiveKeys: ReadonlyArray<string>): unknown { if (Array.isArray(value)) return value.map(item=>redact(item,sensitiveKeys)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,sensitiveKeys.some(s=>s.toLowerCase()===key.toLowerCase())?"[REDACTED]":redact(item,sensitiveKeys)])); }
const failure=(tool:string,started:number,code:string,message:string,retryable=false):ToolResult=>({ok:false,tool,error:{code,message,retryable},meta:{durationMs:Date.now()-started}});
export async function executeToolCall(registry: ToolRegistry, call: AgentToolCall, context: ToolContext): Promise<ToolResult> {
  const started=Date.now(), definition=registry.get(call.name);
  if(!definition) { auditAgent({event:"tool_denied",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:false}); return failure(call.name,started,"TOOL_NOT_REGISTERED","요청한 도구는 사용할 수 없습니다."); }
  let input:unknown; try { input=JSON.parse(call.arguments); } catch { auditAgent({event:"tool_input_invalid",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:false}); return failure(call.name,started,"TOOL_INPUT_INVALID","도구 입력 형식이 올바르지 않습니다.",true); }
  if(!validObject(input,definition.inputSchema)) { auditAgent({event:"tool_input_invalid",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:false}); return failure(call.name,started,"TOOL_INPUT_INVALID","도구 입력값이 허용된 형식과 일치하지 않습니다.",true); }
  if(definition.requiresConnection && (!context.connectionId || !context.connection || context.connection.id!==context.connectionId)) { auditAgent({event:"tool_denied",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:false}); return failure(call.name,started,"CONNECTION_REQUIRED","선택된 대상 DB가 필요합니다."); }
  auditAgent({event:"tool_started",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name});
  try {
    const timeout=Symbol("timeout"); const result=await Promise.race([definition.execute(context,input),new Promise<typeof timeout>(resolve=>setTimeout(()=>resolve(timeout),definition.timeoutMs))]);
    if(result===timeout) return failure(call.name,started,definition.timeoutErrorCode??"TOOL_TIMEOUT","도구 실행 제한시간을 초과했습니다.",true);
    const safe=redact(result,definition.sensitiveKeys), serialized=JSON.stringify(safe), limit=definition.maxResultCharacters;
    const data=serialized.length>limit ? { truncatedJson:serialized.slice(0,limit) } : safe;
    const output:ToolResult={ok:true,tool:call.name,data,meta:{durationMs:Date.now()-started,truncated:serialized.length>limit}};
    auditAgent({event:"tool_finished",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:true,durationMs:output.meta.durationMs});auditRuntimeTool(context,call.name,input,output); return output;
  } catch(error) { const safe=error instanceof SchemaToolError||error instanceof KnowledgeError||error instanceof GitHubToolError||error instanceof RuntimeToolError;const output:ToolResult=safe?{ok:false,tool:call.name,error:{code:error.code,message:error.message,retryable:error.retryable,...(error.details?{details:error.details}:{})},meta:{durationMs:Date.now()-started}}:failure(call.name,started,"TOOL_EXECUTION_FAILED","도구 실행 중 오류가 발생했습니다."); auditAgent({event:"tool_finished",userId:context.userId,conversationId:context.conversationId,connectionId:context.connectionId,tool:call.name,ok:false,durationMs:output.meta.durationMs});auditRuntimeTool(context,call.name,input,output); return output; }
}
