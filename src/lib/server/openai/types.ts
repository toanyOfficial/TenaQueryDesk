export type GeneratedQueryResponse = Readonly<{
  requestType: "select" | "schema_explanation" | "ddl_dml_reference";
  answer: string;
  sql: string | null;
  referencedTables: ReadonlyArray<string>;
  assumptions: ReadonlyArray<string>;
  warnings: ReadonlyArray<string>;
}>;

export type QueryGenerationRecord = Readonly<{
  connectionId: number; prompt: string; model: string; result: GeneratedQueryResponse;
  startedAt: string; completedAt: string; durationMs: number;
}>;
