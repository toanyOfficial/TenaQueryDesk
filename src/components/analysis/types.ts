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
}>;

export type QueryResult = Readonly<{
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  rowCount: number;
  durationMs: number;
}>;

export type QueryStatus = "idle" | "running" | "success" | "empty" | "error";
