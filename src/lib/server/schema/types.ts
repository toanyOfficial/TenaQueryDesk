export const SCHEMA_FORMAT_VERSION = 1 as const;

export type ColumnSchema = Readonly<{
  ordinalPosition: number; name: string; dataType: string; columnType: string;
  characterMaximumLength: number | null; numericPrecision: number | null;
  numericScale: number | null; datetimePrecision: number | null;
  nullable: boolean; defaultValue: string | null; extra: string;
  generated: boolean; generationExpression: string | null;
  characterSet: string | null; collation: string | null; comment: string;
  primaryKey: boolean; uniqueIndex: boolean; indexed: boolean;
  foreignKey: boolean; referencedTable: string | null; referencedColumn: string | null;
}>;
export type IndexSchema = Readonly<{ name: string; primary: boolean; unique: boolean; type: string; columns: ReadonlyArray<Readonly<{ ordinalPosition: number; name: string; prefixLength: number | null; direction: string | null }>> }>;
export type ForeignKeySchema = Readonly<{ constraintName: string; sourceTable: string; sourceColumns: ReadonlyArray<string>; targetTable: string; targetColumns: ReadonlyArray<string>; updateRule: string; deleteRule: string }>;
export type TableSchema = Readonly<{ name: string; type: "BASE TABLE" | "VIEW"; comment: string; engine: string | null; characterSet: string | null; collation: string | null; estimatedRows: number | null; createdAt: string | null; updatedAt: string | null; columns: ReadonlyArray<ColumnSchema>; primaryKey: ReadonlyArray<string>; foreignKeys: ReadonlyArray<ForeignKeySchema>; indexes: ReadonlyArray<IndexSchema>; view: Readonly<{ checkOption: string | null; updatable: boolean | null; securityType: string | null; definition: string | null; definitionAccessible: boolean }> | null }>;
export type TableSchemaDocument = Readonly<{ formatVersion: 1; databaseName: string; table: TableSchema }>;
export type SchemaManifestTable = Readonly<{ name: string; type: "BASE TABLE" | "VIEW"; comment: string; columnCount: number; primaryKey: ReadonlyArray<string>; foreignKeyCount: number; indexCount: number; file: string }>;
export type SchemaManifest = Readonly<{ formatVersion: 1; connectionId: number; connectionKey: string; displayName: string; dbType: "mysql"; databaseName: string; generatedAt: string; tableCount: number; viewCount: number; tables: ReadonlyArray<SchemaManifestTable> }>;
export type DatabaseRelationshipDocument = Readonly<{ formatVersion: 1; generatedAt: string; relationships: ReadonlyArray<ForeignKeySchema> }>;
export type SchemaBundle = Readonly<{ manifest: SchemaManifest; relationships: DatabaseRelationshipDocument; tables: ReadonlyArray<TableSchemaDocument> }>;
export type SchemaGenerationResult = Readonly<{ connectionId: number; connectionKey: string; outputPath: string; generatedAt: string; tableCount: number; viewCount: number; fileCount: number }>;
