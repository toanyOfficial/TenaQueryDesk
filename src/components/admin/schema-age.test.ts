import { describe, expect, test } from "bun:test";
import { getSchemaAgeLabel } from "./schema-age";

describe("admin schema age", () => {
  const now = Date.parse("2026-07-28T00:00:00.000Z");
  test("labels seven and thirty day thresholds", () => {
    expect(getSchemaAgeLabel("2026-07-22T00:00:00.000Z", now)).toBeNull();
    expect(getSchemaAgeLabel("2026-07-21T00:00:00.000Z", now)).toBe("갱신 권장");
    expect(getSchemaAgeLabel("2026-06-28T00:00:00.000Z", now)).toBe("오래된 스키마");
  });
});
