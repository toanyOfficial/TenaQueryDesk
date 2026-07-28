import { describe, expect, test } from "bun:test";

import {
  readPort,
  requireMinimumLength,
  requireNonEmpty,
} from "./env-validation";

describe("server environment validation", () => {
  test("rejects missing and whitespace-only required values", () => {
    expect(() => requireNonEmpty({}, "REQUIRED_VALUE")).toThrow(
      "REQUIRED_VALUE",
    );
    expect(() => requireNonEmpty({ REQUIRED_VALUE: "   " }, "REQUIRED_VALUE"))
      .toThrow("REQUIRED_VALUE");
  });

  test("preserves a non-empty value so credentials are not changed", () => {
    expect(requireNonEmpty({ REQUIRED_VALUE: " value " }, "REQUIRED_VALUE"))
      .toBe(" value ");
  });

  test("enforces minimum secret lengths", () => {
    expect(() => requireMinimumLength({ SECRET: "short" }, "SECRET", 32))
      .toThrow("최소 32자");
    expect(requireMinimumLength({ SECRET: "x".repeat(32) }, "SECRET", 32))
      .toHaveLength(32);
  });

  test("uses the default port only when the value is empty", () => {
    expect(readPort({}, "PORT", 3306)).toBe(3306);
    expect(readPort({ PORT: "  " }, "PORT", 3306)).toBe(3306);
  });

  test("accepts integer ports in range and rejects unsafe values", () => {
    expect(readPort({ PORT: "3307" }, "PORT", 3306)).toBe(3307);
    expect(() => readPort({ PORT: "3.3" }, "PORT", 3306)).toThrow("정수");
    expect(() => readPort({ PORT: "0" }, "PORT", 3306)).toThrow("1~65535");
    expect(() => readPort({ PORT: "65536" }, "PORT", 3306)).toThrow(
      "1~65535",
    );
  });
});
