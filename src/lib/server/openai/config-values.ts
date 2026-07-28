import { requireNonEmpty, type Environment } from "@/lib/server/env-validation";

export type OpenAiRuntimeConfig = Readonly<{ apiKey: string; model: string; requestTimeoutMs: number; maxOutputTokens: number; maxRetries: number }>;
export type OpenAiConfigStatus = Readonly<{ configured: boolean; model: string | null; requestTimeoutMs: number | null; maxOutputTokens: number | null; maxRetries: number | null; issues: ReadonlyArray<"api_key_missing" | "model_missing" | "model_invalid" | "timeout_invalid" | "max_output_tokens_invalid" | "max_retries_invalid"> }>;

function integer(source: Environment, name: string, fallback: number, minimum: number, maximum: number): number {
  const raw=source[name]?.trim(); if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name}은(는) ${minimum}~${maximum} 범위의 정수여야 합니다.`);
  const value=Number(raw); if (!Number.isSafeInteger(value)||value<minimum||value>maximum) throw new Error(`${name}은(는) ${minimum}~${maximum} 범위의 정수여야 합니다.`); return value;
}
export function readOpenAiRuntimeConfig(source: Environment): OpenAiRuntimeConfig {
  const apiKey=requireNonEmpty(source,"OPENAI_API_KEY"), model=requireNonEmpty(source,"OPENAI_MODEL").trim();
  if (model.length>200||/[\r\n\0]/.test(model)) throw new Error("OPENAI_MODEL 형식이 올바르지 않습니다.");
  return Object.freeze({apiKey,model,requestTimeoutMs:integer(source,"OPENAI_REQUEST_TIMEOUT_MS",60_000,5_000,180_000),maxOutputTokens:integer(source,"OPENAI_MAX_OUTPUT_TOKENS",4_000,500,16_000),maxRetries:integer(source,"OPENAI_MAX_RETRIES",1,0,2)});
}
export function getOpenAiRuntimeConfigFromEnvironment(): OpenAiRuntimeConfig { return readOpenAiRuntimeConfig(process.env); }
export function inspectOpenAiConfig(source: Environment=process.env): OpenAiConfigStatus {
  const issues:OpenAiConfigStatus["issues"][number][]=[], apiKey=source.OPENAI_API_KEY?.trim(), model=source.OPENAI_MODEL?.trim();
  if(!apiKey)issues.push("api_key_missing"); if(!model)issues.push("model_missing"); else if(model.length>200||/[\r\n\0]/.test(model))issues.push("model_invalid");
  const check=(name:string,fallback:number,min:number,max:number,issue:OpenAiConfigStatus["issues"][number])=>{try{return integer(source,name,fallback,min,max)}catch{issues.push(issue);return null}};
  const requestTimeoutMs=check("OPENAI_REQUEST_TIMEOUT_MS",60_000,5_000,180_000,"timeout_invalid"),maxOutputTokens=check("OPENAI_MAX_OUTPUT_TOKENS",4_000,500,16_000,"max_output_tokens_invalid"),maxRetries=check("OPENAI_MAX_RETRIES",1,0,2,"max_retries_invalid");
  return {configured:issues.length===0,model:model&&model.length<=200&&!/[\r\n\0]/.test(model)?model:null,requestTimeoutMs,maxOutputTokens,maxRetries,issues};
}
