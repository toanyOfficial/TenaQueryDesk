import { loadCurrentSchemaBundle } from "@/lib/server/schema/select-schema";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SchemaCurrentPointer } from "@/lib/server/schema/types";
import { DEFAULT_AGENT_LIMITS } from "./limits";
import { ToolRegistry } from "./tool-registry";
import type { AgentToolDefinition } from "./types";

const emptyObjectSchema={type:"object",additionalProperties:false,properties:{},required:[]} as const;
const capabilities:AgentToolDefinition={name:"get_service_capabilities",description:"현재 Agent에 실제 등록되어 사용할 수 있는 기능과 아직 연결되지 않은 기능을 확인한다.",inputSchema:emptyObjectSchema,requiresConnection:false,timeoutMs:DEFAULT_AGENT_LIMITS.toolTimeoutMs,maxResultCharacters:DEFAULT_AGENT_LIMITS.maxToolResultCharacters,sensitiveKeys:["password","encryptedPassword","apiKey","token"],async execute(){return {agentToolCalling:true,schemaSearch:false,knowledgeSearch:false,readonlySqlValidation:false,readonlySqlExecution:false,availableTools:["get_service_capabilities","get_selected_database_context"],conversationPersistence:false};}};
const selectedDatabase:AgentToolDefinition={name:"get_selected_database_context",description:"현재 선택된 대상 DB의 안전한 기본 정보와 최신 스키마 생성 상태를 확인한다. 자격증명과 host는 반환하지 않는다.",inputSchema:emptyObjectSchema,requiresConnection:true,timeoutMs:DEFAULT_AGENT_LIMITS.toolTimeoutMs,maxResultCharacters:DEFAULT_AGENT_LIMITS.maxToolResultCharacters,sensitiveKeys:["host","username","password","encryptedPassword"],async execute(context){
  const connection=context.connection!;
  try { const bundle=await loadCurrentSchemaBundle(connection.connectionKey);let version:number|null=null;try{const pointer=JSON.parse(await readFile(path.join(process.cwd(),"schemas",connection.connectionKey,"current.json"),"utf8")) as SchemaCurrentPointer;if(pointer.connectionKey===connection.connectionKey&&Number.isSafeInteger(pointer.latestVersion))version=pointer.latestVersion;}catch{/* Legacy flat schema has no version pointer. */}return {connectionId:connection.id,displayName:connection.displayName,connectionKey:connection.connectionKey,dbType:"mysql",databaseName:connection.databaseName,connectionStatus:connection.connectionStatus,schema:{status:"success",version,generatedAt:bundle.manifest.generatedAt,tableCount:bundle.manifest.tableCount,viewCount:bundle.manifest.viewCount}}; }
  catch { return {connectionId:connection.id,displayName:connection.displayName,connectionKey:connection.connectionKey,dbType:"mysql",databaseName:connection.databaseName,connectionStatus:connection.connectionStatus,schema:{status:"missing",version:null,generatedAt:null,tableCount:null,viewCount:null}}; }
}};
export function createInitialToolRegistry():ToolRegistry { return new ToolRegistry([capabilities,selectedDatabase]); }
