export const KNOWLEDGE_TYPES = ["term", "status_value", "metric", "representative", "relationship", "filter_rule", "sensitivity"] as const;
export const KNOWLEDGE_STATUSES = ["draft", "active", "deprecated", "archived", "invalid"] as const;
export const SENSITIVITY_LEVELS = ["public", "internal", "personal", "secret", "restricted"] as const;
export const RULE_OPERATORS = ["eq", "neq", "in", "not_in", "is_null", "is_not_null", "gt", "gte", "lt", "lte"] as const;

export type KnowledgeType = typeof KNOWLEDGE_TYPES[number];
export type KnowledgeStatus = typeof KNOWLEDGE_STATUSES[number];
export type SensitivityLevel = typeof SENSITIVITY_LEVELS[number];
export type RuleOperator = typeof RULE_OPERATORS[number];

export type KnowledgeTargetInput = Readonly<{
  targetType: "table" | "column" | "relationship" | "value";
  tableName: string;
  columnName?: string | null;
  referencedTable?: string | null;
  referencedColumn?: string | null;
  targetValue?: string | null;
  relationKind?: "foreign_key" | "logical" | "inferred" | "legacy" | null;
  cardinality?: string | null;
  sensitivity?: SensitivityLevel | null;
}>;

export type RuleConditionInput = Readonly<{
  ruleType: "include" | "exclude";
  tableAlias?: string | null;
  columnName: string;
  operator: RuleOperator;
  value?: string | null;
  valueType: "string" | "number" | "boolean" | "date" | "null";
  groupNo: number;
  sequence: number;
}>;

export type MetricInput = Readonly<{
  baseTable: string;
  dateColumn: string;
  aggregationType: "count" | "count_distinct" | "sum" | "avg" | "ratio" | "custom_reference";
  aggregationExpression?: string | null;
  distinctKey?: string | null;
  amountExpression?: string | null;
  timezone: string;
  nullPolicy: "exclude" | "zero" | "include";
}>;

export type BusinessKnowledgeInput = Readonly<{
  connectionId: number | null;
  type: KnowledgeType;
  key: string;
  title: string;
  description: string;
  status: KnowledgeStatus;
  priority: number;
  source: string;
  confidence: "verified" | "reviewed" | "inferred";
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  aliases: ReadonlyArray<string>;
  targets: ReadonlyArray<KnowledgeTargetInput>;
  metric?: MetricInput | null;
  conditions: ReadonlyArray<RuleConditionInput>;
  tags: ReadonlyArray<string>;
  example?: string | null;
  cautions: ReadonlyArray<string>;
}>;

export type BusinessKnowledgeEntry = BusinessKnowledgeInput & Readonly<{
  id: string;
  version: number;
  schemaVersion: string | null;
  validationStatus: "valid" | "invalid" | "unverified";
  validationErrors: ReadonlyArray<string>;
  lastValidatedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type KnowledgeValidation = Readonly<{
  valid: boolean;
  schemaVersion: string | null;
  errors: ReadonlyArray<{ code: string; message: string; table?: string; column?: string }>;
  warnings: ReadonlyArray<{ code: string; message: string }>;
}>;

export type BusinessKnowledgeErrorCode =
  | "BUSINESS_KNOWLEDGE_NOT_FOUND" | "BUSINESS_KNOWLEDGE_ACCESS_DENIED"
  | "BUSINESS_KNOWLEDGE_DUPLICATED" | "BUSINESS_KNOWLEDGE_CONFLICT"
  | "BUSINESS_KNOWLEDGE_INVALID_STATUS" | "BUSINESS_KNOWLEDGE_INVALID_TARGET"
  | "BUSINESS_KNOWLEDGE_SCHEMA_NOT_READY" | "BUSINESS_KNOWLEDGE_SCHEMA_MISMATCH"
  | "BUSINESS_KNOWLEDGE_TABLE_NOT_FOUND" | "BUSINESS_KNOWLEDGE_COLUMN_NOT_FOUND"
  | "BUSINESS_KNOWLEDGE_INVALID_VALUE" | "BUSINESS_KNOWLEDGE_INVALID_RULE"
  | "BUSINESS_KNOWLEDGE_VERSION_CONFLICT" | "BUSINESS_KNOWLEDGE_VALIDATION_FAILED";

export class BusinessKnowledgeError extends Error {
  constructor(public readonly code: BusinessKnowledgeErrorCode, message: string, public readonly retryable = false) {
    super(message);
  }
}
