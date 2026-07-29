import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "./tool-registry";
import { executeToolCall } from "./tool-executor";
import type { AgentToolDefinition, ToolContext } from "./types";
const context:ToolContext={userId:"u",conversationId:"c",connectionId:null,connection:null};
const definition=(overrides:Partial<AgentToolDefinition>={}):AgentToolDefinition=>({name:"sample",description:"test",inputSchema:{type:"object",additionalProperties:false,properties:{value:{type:"string"}},required:["value"]},requiresConnection:false,timeoutMs:100,maxResultCharacters:1000,sensitiveKeys:["password"],async execute(_context,input){return {value:input.value,password:"secret"}},...overrides});
describe("executeToolCall",()=>{
 test("executes valid input and redacts sensitive values",async()=>{const result=await executeToolCall(new ToolRegistry([definition()]),{id:"1",name:"sample",arguments:'{"value":"ok"}'},context);expect(result.ok).toBe(true);if(result.ok)expect(result.data).toEqual({value:"ok",password:"[REDACTED]"});});
 test("rejects invalid input and unknown tools",async()=>{expect((await executeToolCall(new ToolRegistry([definition()]),{id:"1",name:"sample",arguments:"{}"},context)).ok).toBe(false);const missing=await executeToolCall(new ToolRegistry([]),{id:"1",name:"missing",arguments:"{}"},context);expect(missing.ok).toBe(false);});
 test("requires a selected connection",async()=>{const result=await executeToolCall(new ToolRegistry([definition({requiresConnection:true})]),{id:"1",name:"sample",arguments:'{"value":"ok"}'},context);expect(result.ok).toBe(false);if(!result.ok)expect(result.error.code).toBe("CONNECTION_REQUIRED");});
 test("converts exceptions and truncates oversized results",async()=>{const failed=await executeToolCall(new ToolRegistry([definition({async execute(){throw new Error("private")}})]),{id:"1",name:"sample",arguments:'{"value":"ok"}'},context);expect(failed.ok).toBe(false);if(!failed.ok)expect(failed.error.message).not.toContain("private");const large=await executeToolCall(new ToolRegistry([definition({maxResultCharacters:10,async execute(){return {value:"x".repeat(50)}}})]),{id:"2",name:"sample",arguments:'{"value":"ok"}'},context);expect(large.ok&&large.meta.truncated).toBe(true);});
});
