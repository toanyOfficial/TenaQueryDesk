import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "./tool-registry";
import type { AgentToolDefinition } from "./types";
import { createInitialToolRegistry } from "./initial-tools";
const tool=(name:string):AgentToolDefinition=>({name,description:"test",inputSchema:{type:"object",additionalProperties:false,properties:{},required:[]},requiresConnection:false,timeoutMs:100,maxResultCharacters:1000,sensitiveKeys:[],security:{resourceType:"service",action:"read",riskLevel:"low",auditLevel:"basic",classification:"internal"},async execute(){return {ok:true}}});
describe("ToolRegistry",()=>{
  test("registered tools are shared by lookup and OpenAI definitions",()=>{const registry=new ToolRegistry([tool("safe_tool")]);expect(registry.get("safe_tool")?.name).toBe("safe_tool");expect(registry.toOpenAiTools()[0].function.name).toBe("safe_tool");});
  test("unknown tools are absent",()=>expect(new ToolRegistry([]).get("missing")).toBeNull());
  test("duplicate names are rejected",()=>expect(()=>new ToolRegistry([tool("same"),tool("same")])).toThrow("중복"));
  test("registers all schema discovery tools from the same definitions",()=>{const registry=createInitialToolRegistry();for(const name of ["get_schema_summary","list_schema_objects","search_schema","describe_table","find_table_relationships","get_schema_version"])expect(registry.get(name)?.requiresConnection).toBe(true);});
  test("registers document tools without exposing file path inputs",()=>{const registry=createInitialToolRegistry();for(const name of ["list_knowledge_documents","search_knowledge_documents","read_knowledge_document","get_knowledge_capabilities"])expect(registry.get(name)).not.toBeNull();expect(JSON.stringify(registry.get("read_knowledge_document")?.inputSchema)).not.toContain('"path"');});
  test("registers connection-scoped structured business knowledge tools",()=>{const registry=createInitialToolRegistry();for(const name of ["search_business_knowledge","read_business_knowledge","get_column_semantics","get_metric_definition","get_business_relationship"])expect(registry.get(name)?.requiresConnection).toBe(true);});
  test("every registered agent tool has explicit normalized security metadata",()=>{for(const tool of createInitialToolRegistry().list())expect(tool.security).toMatchObject({resourceType:expect.any(String),action:expect.any(String),riskLevel:expect.stringMatching(/low|medium|high/),auditLevel:expect.stringMatching(/basic|detailed/)});});
});
