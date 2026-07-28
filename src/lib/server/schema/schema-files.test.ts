import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertSafeConnectionKey, tableFileName, writeSchemaFiles } from "./write-schema-files";
import type { SchemaBundle } from "./types";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
describe("schema file writer", () => {
  test("blocks path traversal and encodes table names collision-free", () => {
    expect(() => assertSafeConnectionKey("../secret")).toThrow();
    expect(() => assertSafeConnectionKey("UPPER")).toThrow();
    expect(tableFileName("주문 상세")).toMatch(/^t-[0-9a-f]+\.json$/);
    expect(tableFileName("a/b")).not.toContain("/");
  });
  test("writes parseable UTF-8 documents and relative result metadata", async () => {
    root = await mkdtemp(path.join(tmpdir(), "schema-writer-"));
    const name = "고객"; const file = `tables/${tableFileName(name)}`;
    const table = { name, type: "BASE TABLE" as const, comment: "고객 정보", engine: "InnoDB", characterSet: "utf8mb4", collation: null, estimatedRows: 1, createdAt: null, updatedAt: null, columns: [], primaryKey: [], foreignKeys: [], indexes: [], view: null };
    const bundle: SchemaBundle = { manifest: { formatVersion: 1, connectionId: 1, connectionKey: "test_db", displayName: "테스트", dbType: "mysql", databaseName: "test", generatedAt: "2026-01-01T00:00:00.000Z", tableCount: 1, viewCount: 0, tables: [{ name, type: "BASE TABLE", comment: table.comment, columnCount: 0, primaryKey: [], foreignKeyCount: 0, indexCount: 0, file }] }, relationships: { formatVersion: 1, generatedAt: "2026-01-01T00:00:00.000Z", relationships: [] }, tables: [{ formatVersion: 1, databaseName: "test", table }] };
    const result = await writeSchemaFiles(bundle, root);
    expect(result.outputPath).toBe("schemas/test_db");
    expect(JSON.parse(await readFile(path.join(root, "test_db", file), "utf8")).table.comment).toBe("고객 정보");
  });
});
