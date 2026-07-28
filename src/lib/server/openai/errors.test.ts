import { describe,expect,test } from "bun:test";
import { classifyOpenAiHttpError, OpenAiOperationError, toOpenAiError } from "./errors";
describe("OpenAI error classification",()=>{
 test.each([[401,{},"authentication_failed"],[403,{},"model_access_denied"],[404,{},"model_not_found"],[429,{},"rate_limited"],[429,{error:{code:"insufficient_quota"}},"quota_exceeded"],[400,{error:{code:"context_length_exceeded"}},"context_too_large"],[400,{error:{code:"content_filter"}},"safety_refusal"],[400,{},"invalid_request"],[500,{},"service_unavailable"]] as const)("maps HTTP %s",(status,payload,code)=>expect(classifyOpenAiHttpError(status,payload).code).toBe(code));
 test("maps abort, network, parse and unknown safely",()=>{expect(toOpenAiError(new DOMException("","AbortError")).code).toBe("timeout");expect(toOpenAiError(new TypeError()).code).toBe("network_error");expect(toOpenAiError(new SyntaxError()).code).toBe("response_invalid");expect(toOpenAiError(new Error()).code).toBe("unknown");});
 test("never uses raw upstream text",()=>expect(new OpenAiOperationError("authentication_failed").message).not.toContain("key-value"));
});
