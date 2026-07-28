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
  assumptions?: ReadonlyArray<string>;
  warnings?: ReadonlyArray<string>;
  sqlApplied?: boolean;
}>;

export type QueryResult = Readonly<{
  columns: ReadonlyArray<Readonly<{ name: string; type: string }>>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  rowCount: number;
  executionMs: number;
  truncated: boolean;
  warnings: ReadonlyArray<string>;
  referencedTables: ReadonlyArray<string>;
}>;

export type QueryStatus = "idle" | "running" | "success" | "empty" | "error";

export type AnalysisHistoryItem = Readonly<{
  id: number;
  connectionId: number;
  requestType: string;
  userPromptPreview: string;
  assistantAnswerPreview: string | null;
  hasSql: boolean;
  status: "success" | "failed";
  createdAt: string;
}>;

export type AnalysisHistoryDetail = Readonly<{
  id: number;
  connectionId: number;
  requestType: string;
  userPrompt: string;
  assistantAnswer: string | null;
  generatedSql: string | null;
  modelName: string | null;
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
}>;

export type GeneratedQueryResponse = Readonly<{
  requestType: "select" | "schema_explanation" | "ddl_dml_reference";
  answer: string;
  sql: string | null;
  referencedTables: ReadonlyArray<string>;
  assumptions: ReadonlyArray<string>;
  warnings: ReadonlyArray<string>;
}>;
