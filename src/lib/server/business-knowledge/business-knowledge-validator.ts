import type { TargetConnection } from "@/lib/server/db/target-connections";
import { loadSchemaContext } from "@/lib/server/schema-tools/context-service";
import type { BusinessKnowledgeInput, KnowledgeValidation } from "./business-knowledge-types";
import type { SchemaBundle } from "@/lib/server/schema/types";

export async function validateAgainstSchema(input: BusinessKnowledgeInput, connection: TargetConnection | null, schemaOverride?: SchemaBundle): Promise<KnowledgeValidation> {
  const errors: Array<{ code: string; message: string; table?: string; column?: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];
  if (input.connectionId === null) {
    if (input.targets.length || input.metric || input.conditions.length) errors.push({ code: "BUSINESS_KNOWLEDGE_INVALID_TARGET", message: "전역 정의에는 DB 객체 또는 조건을 연결할 수 없습니다." });
    return { valid: errors.length === 0, schemaVersion: null, errors, warnings };
  }
  if (!connection || connection.id !== input.connectionId || !connection.active) return { valid: false, schemaVersion: null, errors: [{ code: "BUSINESS_KNOWLEDGE_SCHEMA_NOT_READY", message: "활성 대상 DB 연결을 찾을 수 없습니다." }], warnings };
  let context;
  try { context = schemaOverride ? { bundle: schemaOverride, versionLabel: "test-version" } : await loadSchemaContext(connection); }
  catch { return { valid: false, schemaVersion: null, errors: [{ code: "BUSINESS_KNOWLEDGE_SCHEMA_NOT_READY", message: "최신 스키마를 먼저 생성해 주세요." }], warnings }; }
  const tables = new Map(context.bundle.tables.map((document) => [document.table.name.toLowerCase(), document.table]));
  const check = (tableName: string, columnName?: string | null) => {
    const table = tables.get(tableName.toLowerCase());
    if (!table) { errors.push({ code: "BUSINESS_KNOWLEDGE_TABLE_NOT_FOUND", message: `${tableName} 테이블이 최신 스키마에 없습니다.`, table: tableName }); return null; }
    if (columnName && !table.columns.some((column) => column.name.toLowerCase() === columnName.toLowerCase())) errors.push({ code: "BUSINESS_KNOWLEDGE_COLUMN_NOT_FOUND", message: `${tableName}.${columnName} 컬럼이 최신 스키마에 없습니다.`, table: tableName, column: columnName });
    return table;
  };
  for (const target of input.targets) {
    const table = check(target.tableName, target.columnName);
    if (target.referencedTable) check(target.referencedTable, target.referencedColumn);
    if (input.type === "status_value" && target.columnName && target.targetValue != null && table) {
      const column = table.columns.find((item) => item.name.toLowerCase() === target.columnName!.toLowerCase());
      if (column && /int|decimal|numeric|float|double/.test(column.dataType) && !Number.isFinite(Number(target.targetValue))) errors.push({ code: "BUSINESS_KNOWLEDGE_INVALID_VALUE", message: `${target.tableName}.${target.columnName} 숫자 타입과 상태값이 호환되지 않습니다.` });
    }
  }
  if (input.metric) {
    check(input.metric.baseTable, input.metric.dateColumn);
    if (input.metric.distinctKey) check(input.metric.baseTable, input.metric.distinctKey);
  }
  const conditionTables = new Set(input.targets.map((target) => target.tableName.toLowerCase()));
  if (input.metric) conditionTables.add(input.metric.baseTable.toLowerCase());
  for (const condition of input.conditions) {
    const candidates = [...conditionTables].map((name) => tables.get(name)).filter(Boolean);
    if (!candidates.some((table) => table!.columns.some((column) => column.name.toLowerCase() === condition.columnName.toLowerCase()))) errors.push({ code: "BUSINESS_KNOWLEDGE_COLUMN_NOT_FOUND", message: `조건 컬럼 ${condition.columnName}을 연결된 테이블에서 찾을 수 없습니다.`, column: condition.columnName });
  }
  return { valid: errors.length === 0, schemaVersion: context.versionLabel, errors, warnings };
}
