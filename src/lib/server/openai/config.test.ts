import { describe,expect,test } from "bun:test";
import { inspectOpenAiConfig, readOpenAiRuntimeConfig } from "./config-values";
const valid={OPENAI_API_KEY:"test-only-placeholder",OPENAI_MODEL:"configured-model",OPENAI_REQUEST_TIMEOUT_MS:"60000",OPENAI_MAX_OUTPUT_TOKENS:"4000",OPENAI_MAX_RETRIES:"1"};
describe("OpenAI runtime config",()=>{
 test("accepts valid lazy configuration",()=>expect(readOpenAiRuntimeConfig(valid)).toMatchObject({model:"configured-model",requestTimeoutMs:60000,maxOutputTokens:4000,maxRetries:1}));
 test("reports missing key and model without exposing a key",()=>{const r=inspectOpenAiConfig({});expect(r.configured).toBe(false);expect(r.issues).toEqual(["api_key_missing","model_missing"]);expect(r).not.toHaveProperty("apiKey");});
 test.each([["OPENAI_REQUEST_TIMEOUT_MS","x"],["OPENAI_REQUEST_TIMEOUT_MS","100"],["OPENAI_REQUEST_TIMEOUT_MS","999999"],["OPENAI_MAX_OUTPUT_TOKENS","x"],["OPENAI_MAX_RETRIES","-1"],["OPENAI_MAX_RETRIES","9"]])("rejects invalid %s=%s",(name,value)=>expect(()=>readOpenAiRuntimeConfig({...valid,[name]:value})).toThrow());
});
