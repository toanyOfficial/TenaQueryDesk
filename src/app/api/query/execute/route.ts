import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getQueryEnvironment } from "@/lib/server/env";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import { executeReadonlySql, ReadonlySqlError } from "@/lib/server/sql-tools/readonly-sql-executor";
import { DEFAULT_SQL_TOOL_POLICY } from "@/lib/server/sql-tools/sql-tool-types";
import { auditReadonlySql } from "@/lib/server/sql-tools/sql-audit";
import { recordConversationExecution } from "@/lib/server/conversation/conversation-service";
import {assertSameOrigin,getAuthenticatedSecurityActor,securityErrorResponse} from "@/lib/server/security/request-security";
import {authorizeApiAction} from "@/lib/server/security/authorization-service";

export async function POST(request: Request) {
  const session=await getSession(); if (!session) return NextResponse.json({ ok: false, errorType: "authentication", error: "인증이 필요합니다." }, { status: 401 });try{assertSameOrigin(request);}catch(error){return securityErrorResponse(error,NextResponse);}
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ ok: false, errorType: "validation", error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, errorType: "validation", error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { connectionId, sql, analysisHistoryId, conversationId } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(connectionId) || (connectionId as number) < 1 || !(analysisHistoryId === null || analysisHistoryId === undefined || (Number.isSafeInteger(analysisHistoryId) && (analysisHistoryId as number) > 0))) return NextResponse.json({ ok: false, errorType: "validation", error: "실행 요청 정보를 확인해 주세요." }, { status: 400 });
  const target=await getTargetConnection(connectionId as number);if(!target||!target.active)return NextResponse.json({ok:false,errorType:"connection",error:"활성 대상 DB 연결을 찾을 수 없습니다."},{status:404});if(typeof sql!=="string")return NextResponse.json({ok:false,errorType:"validation",error:"SQL을 확인해 주세요."},{status:400});try{const actor=await getAuthenticatedSecurityActor();await authorizeApiAction({actor,resourceType:"sql",resourceId:String(target.id),action:"execute",classification:"personal"});}catch(error){return securityErrorResponse(error,NextResponse);}
  const env=getQueryEnvironment(),policy={...DEFAULT_SQL_TOOL_POLICY,maxSqlLength:env.maxSqlLength,absoluteMaxRows:Math.min(env.maxRows,500),defaultMaxRows:Math.min(env.maxRows,200),timeoutMs:Math.min(env.timeoutMs,10_000)};
  try{const result=await executeReadonlySql(sql,target,undefined,policy);if(typeof conversationId==="string")await recordConversationExecution({userId:"shared-user",conversationId,connectionId:target.id,sql,result});auditReadonlySql({userId:"authenticated-session",conversationId:typeof conversationId==="string"?conversationId:`manual-${Date.now()}`,connectionId:target.id,sql,referencedTables:result.referencedTables,validationSucceeded:true,validationErrorCodes:[],executed:true,executionSucceeded:true,durationMs:result.durationMs,rowCount:result.rowCount,truncated:result.truncated});return NextResponse.json({ok:true,queryExecutionLogId:null,result:{...result,executionMs:result.durationMs,submittedSql:sql,executedSql:"server-limited readonly query",analysisHistoryId:analysisHistoryId??null}});}catch(error){const known=error instanceof ReadonlySqlError;return NextResponse.json({ok:false,queryExecutionLogId:null,errorType:known&&error.code==="SQL_EXECUTION_TIMEOUT"?"timeout":known&&error.code.startsWith("SQL_EXECUTION")?"execution":"validation",error:known?error.message:"쿼리 실행에 실패했습니다.",errorCode:known?error.code:"SQL_EXECUTION_FAILED"},{status:known&&error.code.startsWith("SQL_EXECUTION")?503:400});}
}
