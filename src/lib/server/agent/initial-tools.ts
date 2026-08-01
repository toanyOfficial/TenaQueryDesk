import { DEFAULT_AGENT_LIMITS } from "./limits";
import { ToolRegistry } from "./tool-registry";
import type { AgentToolDefinition } from "./types";
import { schemaAgentTools } from "./schema-tools";
import { loadSchemaContext } from "@/lib/server/schema-tools/context-service";
import { knowledgeAgentTools } from "./knowledge-tools";
import { sqlAgentTools } from "./sql-tools";

const emptyObjectSchema={type:"object",additionalProperties:false,properties:{},required:[]} as const;
const capabilities:AgentToolDefinition={name:"get_service_capabilities",description:"현재 Agent에 실제 등록되어 사용할 수 있는 기능과 아직 연결되지 않은 기능을 확인한다.",inputSchema:emptyObjectSchema,requiresConnection:false,timeoutMs:DEFAULT_AGENT_LIMITS.toolTimeoutMs,maxResultCharacters:DEFAULT_AGENT_LIMITS.maxToolResultCharacters,sensitiveKeys:["password","encryptedPassword","apiKey","token"],async execute(){return {agentToolCalling:true,schemaSearch:true,knowledgeSearch:true,readonlySqlValidation:true,readonlySqlExecution:"user_approval_required",availableTools:["get_service_capabilities","get_selected_database_context",...schemaAgentTools.map(tool=>tool.name),...knowledgeAgentTools.map(tool=>tool.name),...sqlAgentTools.map(tool=>tool.name)],conversationPersistence:true};}};
const selectedDatabase:AgentToolDefinition={name:"get_selected_database_context",description:"현재 선택된 대상 DB의 안전한 기본 정보와 최신 스키마 생성 상태를 확인한다. 자격증명과 host는 반환하지 않는다.",inputSchema:emptyObjectSchema,requiresConnection:true,timeoutMs:DEFAULT_AGENT_LIMITS.toolTimeoutMs,maxResultCharacters:DEFAULT_AGENT_LIMITS.maxToolResultCharacters,sensitiveKeys:["host","username","password","encryptedPassword"],async execute(context){
  const connection=context.connection!;
  try { const loaded=await loadSchemaContext(connection);return {connectionId:connection.id,displayName:connection.displayName,connectionKey:connection.connectionKey,dbType:"mysql",databaseName:connection.databaseName,connectionStatus:connection.connectionStatus,schema:{status:"success",version:loaded.version,generatedAt:loaded.generatedAt,tableCount:loaded.bundle.manifest.tableCount,viewCount:loaded.bundle.manifest.viewCount}}; }
  catch { return {connectionId:connection.id,displayName:connection.displayName,connectionKey:connection.connectionKey,dbType:"mysql",databaseName:connection.databaseName,connectionStatus:connection.connectionStatus,schema:{status:"missing",version:null,generatedAt:null,tableCount:null,viewCount:null}}; }
}};
export function createInitialToolRegistry():ToolRegistry { return new ToolRegistry([capabilities,selectedDatabase,...schemaAgentTools,...knowledgeAgentTools,...sqlAgentTools]); }
