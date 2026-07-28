import type { ExecutionPlan, GeneratedQueryResponse, SqlRiskLevel, TransactionGuidance } from "./types";
const REQUEST_TYPES = new Set(["select", "schema_explanation", "ddl_dml_reference"]), RISK_LEVELS = new Set(["read_only", "data_change", "schema_change", "destructive"]);
const DDL = /\b(?:CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i, DML = /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
function strings(value: unknown, field: string): string[] { if (!Array.isArray(value) || value.some(x => typeof x !== "string" || !x.trim() || x.length > 5_000)) throw new Error(`잘못된 GPT 응답 필드: ${field}`); return [...new Set((value as string[]).map(x => x.trim()))]; }
function transaction(value: unknown): TransactionGuidance { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 트랜잭션 안내입니다."); const v=value as Record<string,unknown>; if (typeof v.applicable !== "boolean" || !(v.summary === null || typeof v.summary === "string") || (typeof v.summary === "string" && v.summary.length > 5_000)) throw new Error("잘못된 트랜잭션 안내입니다."); return { applicable:v.applicable, summary:typeof v.summary === "string" ? v.summary.trim() : null }; }
function plan(value: unknown): ExecutionPlan | null { if (value === null) return null; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 실행 계획입니다."); const v=value as Record<string,unknown>; return { preChecks:strings(v.preChecks,"preChecks"), statements:strings(v.statements,"statements"), postChecks:strings(v.postChecks,"postChecks"), rollbackOrRecovery:strings(v.rollbackOrRecovery,"rollbackOrRecovery") }; }
function unsafeMutation(statement: string) { const clean=statement.replace(/--.*$/gm, " "); return /\b(?:UPDATE|DELETE)\b/i.test(clean) && !/\bWHERE\b/i.test(clean); }
export function parseGeneratedQueryResponse(value: unknown, allowedTables: ReadonlySet<string>): GeneratedQueryResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 GPT 응답입니다."); const item=value as Record<string,unknown>;
  if (typeof item.requestType !== "string" || !REQUEST_TYPES.has(item.requestType)) throw new Error("잘못된 GPT 요청 유형입니다.");
  if (typeof item.answer !== "string" || !item.answer.trim() || item.answer.length > 10_000) throw new Error("잘못된 GPT 설명입니다.");
  if (item.sql !== null && (typeof item.sql !== "string" || !item.sql.trim() || item.sql.length > 50_000 || item.sql.includes("```"))) throw new Error("잘못된 GPT SQL입니다.");
  if (typeof item.riskLevel !== "string" || !RISK_LEVELS.has(item.riskLevel)) throw new Error("잘못된 SQL 위험도입니다.");
  const requestType=item.requestType as GeneratedQueryResponse["requestType"], riskLevel=item.riskLevel as SqlRiskLevel, sql=item.sql as string|null, guidance=transaction(item.transactionGuidance), executionPlan=plan(item.executionPlan);
  if (requestType === "select" && typeof sql !== "string") throw new Error("조회 요청에 SQL이 없습니다.");
  if (requestType !== "ddl_dml_reference" && (riskLevel !== "read_only" || guidance.applicable || executionPlan !== null)) throw new Error("조회 또는 설명 응답에 변경 절차가 포함되었습니다.");
  const referencedTables=strings(item.referencedTables,"referencedTables"); if (referencedTables.some(t => !allowedTables.has(t))) throw new Error("GPT가 제공되지 않은 테이블을 참조했습니다.");
  const warnings=strings(item.warnings,"warnings"), assumptions=strings(item.assumptions,"assumptions");
  if (requestType === "ddl_dml_reference") {
    if (riskLevel === "read_only" || !executionPlan || executionPlan.statements.length === 0 || executionPlan.preChecks.length === 0 || executionPlan.postChecks.length === 0 || executionPlan.rollbackOrRecovery.length === 0) throw new Error("변경 SQL의 안전 실행 계획이 없습니다.");
    const combined=[sql ?? "", ...executionPlan.statements].join("\n"), narrative=[item.answer, guidance.summary ?? "", ...warnings, ...executionPlan.rollbackOrRecovery].join("\n");
    if (executionPlan.statements.some(unsafeMutation)) throw new Error("WHERE 없는 UPDATE 또는 DELETE는 제안할 수 없습니다.");
    if (DDL.test(combined) && /(?:전체|모든).{0,30}(?:자동 )?롤백.{0,20}(?:보장|가능)/i.test(narrative)) throw new Error("DDL 전체 롤백을 보장하는 잘못된 응답입니다.");
    if (DML.test(combined) && /\bCOMMIT\b/i.test(combined) && !/ROLLBACK/i.test(narrative)) throw new Error("DML 오류 시 ROLLBACK 안내가 없습니다.");
    if (riskLevel === "destructive" && warnings.length === 0) throw new Error("파괴적 변경의 경고가 없습니다.");
    warnings.unshift("사이트에서 실행할 수 없는 참고용 변경 SQL입니다.");
    if (DDL.test(combined)) warnings.push("MySQL DDL은 암시적 커밋이 발생할 수 있어 전체 트랜잭션 롤백이 보장되지 않습니다.");
    if (DDL.test(combined) && DML.test(combined)) warnings.push("DDL과 DML 혼합 작업은 전체 원자성이 보장되지 않으므로 단계별 검증과 복구가 필요합니다.");
  }
  return { requestType, answer:item.answer.trim(), sql:sql?.trim()??null, referencedTables, assumptions, warnings:[...new Set(warnings)], riskLevel, transactionGuidance:guidance, executionPlan };
}
const list={ type:"array",items:{type:"string"} } as const;
export const GENERATED_QUERY_JSON_SCHEMA={name:"generated_query_response",strict:true,schema:{type:"object",additionalProperties:false,required:["requestType","answer","sql","referencedTables","assumptions","warnings","riskLevel","transactionGuidance","executionPlan"],properties:{requestType:{type:"string",enum:["select","schema_explanation","ddl_dml_reference"]},answer:{type:"string"},sql:{type:["string","null"]},referencedTables:list,assumptions:list,warnings:list,riskLevel:{type:"string",enum:["read_only","data_change","schema_change","destructive"]},transactionGuidance:{type:"object",additionalProperties:false,required:["applicable","summary"],properties:{applicable:{type:"boolean"},summary:{type:["string","null"]}}},executionPlan:{anyOf:[{type:"null"},{type:"object",additionalProperties:false,required:["preChecks","statements","postChecks","rollbackOrRecovery"],properties:{preChecks:list,statements:list,postChecks:list,rollbackOrRecovery:list}}]}}}} as const;
