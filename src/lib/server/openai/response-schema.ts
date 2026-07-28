import type { GeneratedQueryResponse } from "./types";
const REQUEST_TYPES = new Set(["select", "schema_explanation", "ddl_dml_reference"]);
function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length > 1_000)) throw new Error(`잘못된 GPT 응답 필드: ${field}`);
  return [...new Set(value as string[])];
}
export function parseGeneratedQueryResponse(value: unknown, allowedTables: ReadonlySet<string>): GeneratedQueryResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 GPT 응답입니다.");
  const item = value as Record<string, unknown>;
  if (typeof item.requestType !== "string" || !REQUEST_TYPES.has(item.requestType)) throw new Error("잘못된 GPT 요청 유형입니다.");
  if (typeof item.answer !== "string" || !item.answer.trim() || item.answer.length > 10_000) throw new Error("잘못된 GPT 설명입니다.");
  if (item.sql !== null && (typeof item.sql !== "string" || !item.sql.trim() || item.sql.length > 50_000 || item.sql.includes("```"))) throw new Error("잘못된 GPT SQL입니다.");
  if (item.requestType === "select" && typeof item.sql !== "string") throw new Error("조회 요청에 SQL이 없습니다.");
  const referencedTables = stringArray(item.referencedTables, "referencedTables");
  if (referencedTables.some((table) => !allowedTables.has(table))) throw new Error("GPT가 제공되지 않은 테이블을 참조했습니다.");
  const warnings = stringArray(item.warnings, "warnings");
  const sql = item.sql as string | null;
  if (sql && sql.slice(0, -1).includes(";")) warnings.push("다중 SQL 문장 가능성이 있어 실행 전 검증이 필요합니다.");
  if (item.requestType === "ddl_dml_reference") warnings.unshift("사이트에서 실행할 수 없는 참고용 쿼리입니다.");
  return { requestType: item.requestType as GeneratedQueryResponse["requestType"], answer: item.answer.trim(), sql: sql?.trim() ?? null, referencedTables, assumptions: stringArray(item.assumptions, "assumptions"), warnings: [...new Set(warnings)] };
}
export const GENERATED_QUERY_JSON_SCHEMA = { name: "generated_query_response", strict: true, schema: { type: "object", additionalProperties: false, required: ["requestType", "answer", "sql", "referencedTables", "assumptions", "warnings"], properties: { requestType: { type: "string", enum: ["select", "schema_explanation", "ddl_dml_reference"] }, answer: { type: "string" }, sql: { type: ["string", "null"] }, referencedTables: { type: "array", items: { type: "string" } }, assumptions: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } } } } } as const;
