import type { SchemaBundle } from "@/lib/server/schema/types";
import type { TargetConnection } from "@/lib/server/db/target-connections";

export type LoadedSchemaContext = Readonly<{ connection: TargetConnection; bundle: SchemaBundle; version: number | null; versionLabel: string; schemaHash: string | null; generatedAt: string; previousVersionExists: boolean }>;
export type SchemaToolErrorCode = "CONNECTION_NOT_SELECTED"|"CONNECTION_NOT_FOUND"|"SCHEMA_NOT_GENERATED"|"SCHEMA_POINTER_NOT_FOUND"|"SCHEMA_VERSION_NOT_FOUND"|"SCHEMA_FILE_CORRUPTED"|"SCHEMA_OBJECT_NOT_FOUND"|"TABLE_NOT_FOUND"|"INVALID_SCHEMA_QUERY"|"SCHEMA_RESULT_TOO_LARGE"|"SCHEMA_TOOL_TIMEOUT";
export class SchemaToolError extends Error { constructor(readonly code:SchemaToolErrorCode,message:string,readonly retryable:boolean,readonly details?:Readonly<Record<string,unknown>>){super(message);this.name="SchemaToolError";} }
