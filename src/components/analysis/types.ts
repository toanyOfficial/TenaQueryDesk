export type DatabaseOption = Readonly<{
  id: number;
  connectionKey: string;
  displayName: string;
  dbType: "mysql";
}>;

export type SchemaSummary = Readonly<{
  versionNo: number;
  status: "processing" | "success" | "failed" | "missing";
  tableCount: number | null;
  generatedAt: string | null;
  schemaHash: string | null;
}>;

export type AnalysisMessage = Readonly<{
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  status?: "pending" | "success" | "failed";
  referencedTables?: ReadonlyArray<string>;
  referencedDocuments?: ReadonlyArray<Readonly<{ id:string; title:string; version:number; updatedAt:string; status:string }>>;
  businessKnowledge?: ReadonlyArray<Readonly<{id:string;title:string;version:number;type:string;appliedRules:ReadonlyArray<string>}>>;
  toolsUsed?: ReadonlyArray<string>;
  assumptions?: ReadonlyArray<string>;
  warnings?: ReadonlyArray<string>;
  sqlApplied?: boolean;
  requestType?: "select" | "schema_explanation" | "ddl_dml_reference";
  riskLevel?: SqlRiskLevel;
  transactionGuidance?: Readonly<{ applicable: boolean; summary: string | null }>;
  executionPlan?: ExecutionPlan | null;
}>;

export type QueryResult = Readonly<{
  columns: ReadonlyArray<Readonly<{ name: string; type: string }>>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  rowCount: number;
  executionMs: number;
  truncated: boolean;
  warnings: ReadonlyArray<string>;
  referencedTables: ReadonlyArray<string>;
  queryExecutionLogId: number | null;
  analysisHistoryId: number | null;
  historyWarning: string | null;
  executedAt: string;
}>;

export type QueryStatus = "idle" | "running" | "success" | "empty" | "error";

export type AnalysisHistoryItem = Readonly<{
  id: string;
  connectionId: number;
  title: string;
  requestType: string;
  userPromptPreview: string;
  assistantAnswerPreview: string | null;
  hasSql: boolean;
  status: "success" | "archived";
  executed: boolean;
  messageCount: number;
  createdAt: string;
}>;

export type AnalysisHistoryDetail = Readonly<{
  id: string;
  connectionId: number;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  lastActivityAt: string;
  messages: ReadonlyArray<Readonly<{id:string;role:"user"|"assistant";content:string;status:"success"|"failed";createdAt:string;metadata:Readonly<{sql?:string|null;references?:GeneratedQueryResponse["references"];warnings?:ReadonlyArray<string>;toolsUsed?:ReadonlyArray<string>}>|null}>>;
  workingState: Readonly<{lastSql:string|null;executed:boolean;resultSummary:Record<string,unknown>|null}>|null;
}>;

export type QueryHistoryItem = Readonly<{
  id: number;
  connectionId: number;
  analysisHistoryId: number | null;
  sqlPreview: string;
  success: boolean;
  rowCount: number | null;
  executionMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}>;

export type QueryHistoryDetail = Readonly<{
  id: number;
  connectionId: number;
  analysisHistoryId: number | null;
  sqlText: string;
  success: boolean;
  rowCount: number | null;
  executionMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}>;

export type SqlRiskLevel = "read_only" | "data_change" | "schema_change" | "destructive";
export type ExecutionPlan = Readonly<{ preChecks: ReadonlyArray<string>; statements: ReadonlyArray<string>; postChecks: ReadonlyArray<string>; rollbackOrRecovery: ReadonlyArray<string> }>;
export type GeneratedQueryResponse = Readonly<{
  requestType: "select" | "schema_explanation" | "ddl_dml_reference";
  answer: string; sql: string | null; referencedTables: ReadonlyArray<string>; assumptions: ReadonlyArray<string>; warnings: ReadonlyArray<string>;
  references?: Readonly<{ schemaVersion:string|null; tables:ReadonlyArray<string>; documents:ReadonlyArray<Readonly<{id:string;title:string;version:number;updatedAt:string;status:string}>>; businessKnowledge:ReadonlyArray<Readonly<{id:string;title:string;version:number;type:string;appliedRules:ReadonlyArray<string>}>>; toolsUsed:ReadonlyArray<string> }>;
  riskLevel: SqlRiskLevel; transactionGuidance: Readonly<{ applicable: boolean; summary: string | null }>; executionPlan: ExecutionPlan | null;
}>;
