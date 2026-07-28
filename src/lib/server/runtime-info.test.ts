import { describe, expect, test } from "bun:test";

import { parseRuntimePort } from "./runtime-values";

describe("parseRuntimePort", () => {
  test("accepts a valid injected service port", () => expect(parseRuntimePort("3800")).toBe(3800));
  test.each([undefined, "", "0", "65536", "38x0", " 3800"])("rejects invalid port %p", value => {
    expect(parseRuntimePort(value)).toBeNull();
  });
});
