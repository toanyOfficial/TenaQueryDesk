export type SqlRiskLevel = "read_only" | "data_change" | "schema_change" | "destructive";
export type TransactionGuidance = Readonly<{ applicable: boolean; summary: string | null }>;
export type ExecutionPlan = Readonly<{ preChecks: ReadonlyArray<string>; statements: ReadonlyArray<string>; postChecks: ReadonlyArray<string>; rollbackOrRecovery: ReadonlyArray<string> }>;
export type GeneratedQueryResponse = Readonly<{
  requestType: "select" | "schema_explanation" | "ddl_dml_reference";
  answer: string; sql: string | null; referencedTables: ReadonlyArray<string>; assumptions: ReadonlyArray<string>; warnings: ReadonlyArray<string>;
  riskLevel: SqlRiskLevel; transactionGuidance: TransactionGuidance; executionPlan: ExecutionPlan | null;
}>;
export type QueryGenerationRecord = Readonly<{ connectionId: number; prompt: string; model: string; result: GeneratedQueryResponse; startedAt: string; completedAt: string; durationMs: number }>;
