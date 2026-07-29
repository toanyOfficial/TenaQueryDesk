import { DEFAULT_AGENT_LIMITS } from "./limits";
import type { AgentToolDefinition, ToolContext } from "./types";
import { loadSchemaContext } from "@/lib/server/schema-tools/context-service";
import { searchSchemaBundle } from "@/lib/server/schema-tools/search-service";
import { describeTable, findTableRelationships, getSchemaSummary, getSchemaVersion, listSchemaObjects } from "@/lib/server/schema-tools/schema-service";

const policy={requiresConnection:true,timeoutMs:DEFAULT_AGENT_LIMITS.toolTimeoutMs,timeoutErrorCode:"SCHEMA_TOOL_TIMEOUT",maxResultCharacters:DEFAULT_AGENT_LIMITS.maxToolResultCharacters,sensitiveKeys:["host","username","password","encryptedPassword","path"]} as const;
const empty={type:"object",additionalProperties:false,properties:{},required:[]} as const;
const context=(toolContext:ToolContext)=>loadSchemaContext(toolContext.connection);
export const schemaAgentTools:ReadonlyArray<AgentToolDefinition>=[
 {name:"get_schema_summary",description:"DB의 전체 스키마 규모, 현재 버전과 주요 객체를 먼저 파악할 때 사용한다. 전체 원문 대신 제한된 요약을 반환한다.",inputSchema:empty,...policy,async execute(toolContext){return getSchemaSummary(await context(toolContext));}},
 {name:"get_schema_version",description:"현재 정적 스키마의 버전, 해시, 생성 시각과 실제 DB 동기화 확인 여부를 확인할 때 사용한다.",inputSchema:empty,...policy,async execute(toolContext){return getSchemaVersion(await context(toolContext));}},
 {name:"list_schema_objects",description:"테이블 또는 뷰 목록을 페이지 단위로 탐색할 때 사용한다.",inputSchema:{type:"object",additionalProperties:false,properties:{objectType:{type:"string",enum:["table","view","all"]},page:{type:"integer",minimum:1,maximum:100000},pageSize:{type:"integer",minimum:1,maximum:100}},required:["objectType","page","pageSize"]},...policy,async execute(toolContext,input){return listSchemaObjects(await context(toolContext),input as {objectType:"table"|"view"|"all";page:number;pageSize:number});}},
 {name:"search_schema",description:"자연어 업무 표현이나 불명확한 테이블·컬럼 이름으로 관련 스키마 후보를 찾을 때 사용한다. 결과가 없으면 다른 검색어나 요약 도구를 시도한다.",inputSchema:{type:"object",additionalProperties:false,properties:{query:{type:"string",minLength:1,maxLength:500},limit:{type:"integer",minimum:1,maximum:20}},required:["query","limit"]},...policy,async execute(toolContext,input){const loaded=await context(toolContext);return {query:input.query,schemaVersion:loaded.versionLabel,matches:searchSchemaBundle(loaded.bundle,input.query as string,input.limit as number)};}},
 {name:"describe_table",description:"검색으로 확인한 특정 테이블 또는 뷰의 실제 컬럼, 타입, 키와 인덱스를 확인할 때 사용한다. SQL 작성 전에 사용 테이블을 확인한다.",inputSchema:{type:"object",additionalProperties:false,properties:{tableName:{type:"string",minLength:1,maxLength:128}},required:["tableName"]},...policy,async execute(toolContext,input){return describeTable(await context(toolContext),input.tableName as string);}},
 {name:"find_table_relationships",description:"확인된 테이블의 명시적 외래키 JOIN 관계를 확인할 때 사용한다. 현재 depth 1만 지원하며 추론 관계는 반환하지 않는다.",inputSchema:{type:"object",additionalProperties:false,properties:{tableName:{type:"string",minLength:1,maxLength:128},direction:{type:"string",enum:["outgoing","incoming","both"]},depth:{type:"integer",enum:[1]}},required:["tableName","direction","depth"]},...policy,async execute(toolContext,input){return findTableRelationships(await context(toolContext),input.tableName as string,input.direction as "outgoing"|"incoming"|"both",input.depth as number);}},
];
