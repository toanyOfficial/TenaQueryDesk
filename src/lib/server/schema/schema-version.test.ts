import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { publishCurrentSchema, assertSafeSchemaRelativePath } from "./schema-current";
import { calculateSchemaHash } from "./schema-hash";
import type { SchemaBundle } from "./types";
import { schemaVersionDirectoryName, tableFileName, writeVersionedSchemaFiles } from "./write-schema-files";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

function bundle(generatedAt: string, columnNames = ["id"]): SchemaBundle {
  const name = "orders";
  const file = `tables/${tableFileName(name)}`;
  const columns = columnNames.map((columnName, index) => ({
    ordinalPosition: index + 1, name: columnName, dataType: "int", columnType: "int",
    characterMaximumLength: null, numericPrecision: 10, numericScale: 0,
    datetimePrecision: null, nullable: false, defaultValue: null, extra: "",
    generated: false, generationExpression: null, characterSet: null, collation: null,
    comment: "", primaryKey: index === 0, uniqueIndex: index === 0, indexed: index === 0,
    foreignKey: false, referencedTable: null, referencedColumn: null,
  }));
  const table = { name, type: "BASE TABLE" as const, comment: "주문", engine: "InnoDB", characterSet: "utf8mb4", collation: null, estimatedRows: 1, createdAt: null, updatedAt: null, columns, primaryKey: ["id"], foreignKeys: [], indexes: [], view: null };
  return {
    manifest: { formatVersion: 1, connectionId: 1, connectionKey: "sales", displayName: "매출", dbType: "mysql", databaseName: "sales", generatedAt, tableCount: 1, viewCount: 0, tables: [{ name, type: "BASE TABLE", comment: "주문", columnCount: columns.length, primaryKey: ["id"], foreignKeyCount: 0, indexCount: 0, file }] },
    relationships: { formatVersion: 1, generatedAt, relationships: [] },
    tables: [{ formatVersion: 1, databaseName: "sales", table }],
  };
}

describe("versioned schema files", () => {
  test("hash is stable across generation timestamps and changes with structure", () => {
    const first = calculateSchemaHash(bundle("2026-01-01T00:00:00.000Z"));
    const second = calculateSchemaHash(bundle("2026-01-02T00:00:00.000Z"));
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(calculateSchemaHash(bundle("2026-01-02T00:00:00.000Z", ["id", "status"]))).not.toBe(first);
  });

  test("preserves versions and atomically publishes a relative current pointer", async () => {
    root = await mkdtemp(path.join(tmpdir(), "schema-version-"));
    const input = bundle("2026-01-01T00:00:00.000Z");
    const first = await writeVersionedSchemaFiles(input, 1, root);
    const second = await writeVersionedSchemaFiles(input, 2, root);
    expect(first.outputPath).toBe("schemas/sales/versions/v000001");
    expect(second.outputPath).toBe("schemas/sales/versions/v000002");
    const schemaHash = calculateSchemaHash(input);
    await publishCurrentSchema({ formatVersion: 1, connectionId: 1, connectionKey: "sales", latestVersion: 2, path: "versions/v000002", generatedAt: input.manifest.generatedAt, schemaHash }, root);
    const current = JSON.parse(await readFile(path.join(root, "sales", "current.json"), "utf8"));
    expect(current.path).toBe("versions/v000002");
    expect(await readFile(path.join(root, "sales", "versions", "v000001", "manifest.json"), "utf8")).toContain("orders");
  });

  test("rejects invalid versions and paths", () => {
    expect(() => schemaVersionDirectoryName(0)).toThrow();
    expect(() => assertSafeSchemaRelativePath("sales", "/etc/passwd")).toThrow();
    expect(() => assertSafeSchemaRelativePath("sales", "schemas/sales/versions/../../secret")).toThrow();
    expect(() => assertSafeSchemaRelativePath("sales", "schemas/sales/versions/v000001")).not.toThrow();
  });
});
