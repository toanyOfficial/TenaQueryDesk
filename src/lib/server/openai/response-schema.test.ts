import { describe, expect, test } from "bun:test";
import { parseGeneratedQueryResponse } from "./response-schema";
describe("structured GPT response", () => {
  test("accepts known tables and normalizes SQL", () => { const result = parseGeneratedQueryResponse({ requestType: "select", answer: "설명", sql: " SELECT id FROM orders ", referencedTables: ["orders"], assumptions: [], warnings: [] }, new Set(["orders"])); expect(result.sql).toBe("SELECT id FROM orders"); });
  test("rejects hallucinated tables, fences, and missing select SQL", () => { const base = { requestType: "select", answer: "설명", sql: "SELECT 1", referencedTables: ["missing"], assumptions: [], warnings: [] }; expect(() => parseGeneratedQueryResponse(base, new Set(["orders"]))).toThrow(); expect(() => parseGeneratedQueryResponse({ ...base, referencedTables: [], sql: "```sql\nSELECT 1\n```" }, new Set())).toThrow(); expect(() => parseGeneratedQueryResponse({ ...base, referencedTables: [], sql: null }, new Set())).toThrow(); });
  test("marks DDL/DML as reference only", () => { const result = parseGeneratedQueryResponse({ requestType: "ddl_dml_reference", answer: "참고", sql: "ALTER TABLE orders ADD x INT", referencedTables: ["orders"], assumptions: [], warnings: [] }, new Set(["orders"])); expect(result.warnings[0]).toContain("참고용"); });
});
