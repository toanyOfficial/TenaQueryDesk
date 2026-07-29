import "server-only";
import { getOpenAiRuntimeConfig } from "./config";
import { classifyOpenAiHttpError, OpenAiOperationError, toOpenAiError } from "./errors";
import { GENERATED_QUERY_JSON_SCHEMA } from "./response-schema";
const OPENAI_ENDPOINT="https://api.openai.com/v1/chat/completions";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function retryDelay(response:Response|undefined,attempt:number){const raw=response?.headers.get("retry-after"),seconds=raw?Number(raw):NaN;return Number.isFinite(seconds)?Math.min(2_000,Math.max(100,seconds*1_000)):Math.min(2_000,250*2**attempt)}
export async function requestStructuredCompletion(system:string,user:string):Promise<{model:string;value:unknown;retryCount:number}>{
 let config;try{config=getOpenAiRuntimeConfig()}catch{throw new OpenAiOperationError("config_missing")}
 const deadline=Date.now()+config.requestTimeoutMs;
 for(let attempt=0;attempt<=config.maxRetries;attempt++){
  const remaining=deadline-Date.now();if(remaining<=0)throw new OpenAiOperationError("timeout");const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),remaining);let response:Response|undefined;
  try{
   response=await fetch(OPENAI_ENDPOINT,{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:config.model,messages:[{role:"system",content:system},{role:"user",content:user}],response_format:{type:"json_schema",json_schema:GENERATED_QUERY_JSON_SCHEMA},max_completion_tokens:config.maxOutputTokens})});
   const payload=await response.json().catch(()=>null) as {choices?:Array<{finish_reason?:string;message?:{content?:string|null;refusal?:string|null}}>}|null;
   if(!response.ok)throw classifyOpenAiHttpError(response.status,payload);
   const choice=payload?.choices?.[0];if(choice?.message?.refusal||choice?.finish_reason==="content_filter")throw new OpenAiOperationError("safety_refusal");
   const content=choice?.message?.content;if(!content)throw new OpenAiOperationError("response_invalid");
   let value:unknown;try{value=JSON.parse(content)}catch{throw new OpenAiOperationError("response_invalid")}
   return {model:config.model,value,retryCount:attempt};
  }catch(cause){const error=toOpenAiError(cause);if(!error.retryable||attempt>=config.maxRetries)throw error;const delay=retryDelay(response,attempt);if(Date.now()+delay>=deadline)throw new OpenAiOperationError("timeout");await sleep(delay);}
  finally{clearTimeout(timer)}
 }
 throw new OpenAiOperationError("unknown");
}
