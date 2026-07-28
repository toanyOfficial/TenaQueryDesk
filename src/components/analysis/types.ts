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
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  rowCount: number;
  durationMs: number;
}>;

export type QueryStatus = "idle" | "running" | "success" | "empty" | "error";

export type GeneratedQueryResponse = Readonly<{
  requestType: "select" | "schema_explanation" | "ddl_dml_reference";
  answer: string;
  sql: string | null;
  referencedTables: ReadonlyArray<string>;
  assumptions: ReadonlyArray<string>;
  warnings: ReadonlyArray<string>;
}>;
