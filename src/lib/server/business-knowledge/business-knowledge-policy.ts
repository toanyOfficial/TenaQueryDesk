import { BusinessKnowledgeError, KNOWLEDGE_STATUSES, KNOWLEDGE_TYPES, RULE_OPERATORS, SENSITIVITY_LEVELS, type BusinessKnowledgeInput } from "./business-knowledge-types";

const IDENTIFIER = /^[A-Za-z0-9_$\p{L}][A-Za-z0-9_$\p{L}.-]{0,127}$/u;
const KEY = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const SYSTEM_SCHEMAS = new Set(["information_schema", "mysql", "performance_schema", "sys"]);

export function validateKnowledgeInput(value: unknown): BusinessKnowledgeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE","업무 지식 입력 형식이 올바르지 않습니다.");
  const item = value as Partial<BusinessKnowledgeInput>;
  if (!(KNOWLEDGE_TYPES as readonly unknown[]).includes(item.type) || !(KNOWLEDGE_STATUSES as readonly unknown[]).includes(item.status)) invalid("BUSINESS_KNOWLEDGE_INVALID_STATUS","업무 지식 유형 또는 상태가 올바르지 않습니다.");
  if (!KEY.test(item.key ?? "") || !text(item.title, 160) || !text(item.description, 10_000) || !text(item.source, 500)) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE","key, 제목, 설명과 출처를 확인해 주세요.");
  if (!(item.connectionId === null || (Number.isSafeInteger(item.connectionId) && item.connectionId! > 0)) || !Number.isSafeInteger(item.priority) || item.priority! < 0 || item.priority! > 1000) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE","적용 범위 또는 우선순위가 올바르지 않습니다.");
  if (!Array.isArray(item.aliases) || !Array.isArray(item.targets) || !Array.isArray(item.conditions) || !Array.isArray(item.tags) || !Array.isArray(item.cautions)) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE","별칭, 대상, 조건, 태그 형식이 올바르지 않습니다.");
  if (item.aliases.some((alias) => typeof alias !== "string" || !alias.trim() || alias.length > 160) || item.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 100) || item.cautions.some((caution) => typeof caution !== "string" || caution.length > 1000)) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE", "별칭, 태그 또는 주의사항의 길이를 확인해 주세요.");
  for (const target of item.targets) {
    if (!IDENTIFIER.test(target.tableName) || SYSTEM_SCHEMAS.has(target.tableName.split(".")[0].toLowerCase()) || (target.columnName && !IDENTIFIER.test(target.columnName)) || (target.referencedTable && !IDENTIFIER.test(target.referencedTable)) || (target.referencedColumn && !IDENTIFIER.test(target.referencedColumn)) || (target.sensitivity && !(SENSITIVITY_LEVELS as readonly unknown[]).includes(target.sensitivity))) invalid("BUSINESS_KNOWLEDGE_INVALID_TARGET","업무 지식 대상 객체가 올바르지 않습니다.");
  }
  for (const rule of item.conditions) {
    if (!IDENTIFIER.test(rule.columnName) || !(RULE_OPERATORS as readonly unknown[]).includes(rule.operator) || !Number.isSafeInteger(rule.groupNo) || !Number.isSafeInteger(rule.sequence) || ((rule.operator === "is_null" || rule.operator === "is_not_null") && rule.value != null)) invalid("BUSINESS_KNOWLEDGE_INVALID_RULE","구조화된 조건이 올바르지 않습니다.");
  }
  if (item.type === "metric" && (!item.metric || !IDENTIFIER.test(item.metric.baseTable) || !IDENTIFIER.test(item.metric.dateColumn))) invalid("BUSINESS_KNOWLEDGE_INVALID_TARGET","지표의 기준 테이블과 날짜 컬럼이 필요합니다.");
  if (item.metric && [item.metric.aggregationExpression, item.metric.amountExpression].some((expression) => expression && (expression.length > 1000 || /;|--|\/\*|\b(?:insert|update|delete|drop|alter|create|outfile|load_file|sleep)\b/i.test(expression)))) invalid("BUSINESS_KNOWLEDGE_INVALID_RULE", "지표 참고식에는 단일 읽기 전용 계산 표현만 기록할 수 있습니다.");
  if (item.effectiveFrom && item.effectiveTo && item.effectiveFrom > item.effectiveTo) invalid("BUSINESS_KNOWLEDGE_INVALID_VALUE","적용 종료일은 시작일보다 빠를 수 없습니다.");
  return item as BusinessKnowledgeInput;
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\0\r]/.test(value);
}

function invalid(code: ConstructorParameters<typeof BusinessKnowledgeError>[0], message: string): never { throw new BusinessKnowledgeError(code, message); }
