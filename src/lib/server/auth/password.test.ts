import { describe, expect, test } from "bun:test";

import { MAX_PASSWORD_LENGTH, verifyPasswordHash } from "./password-hash";

describe("shared password policy", () => {
  test("Bun verifies an Argon2id hash without comparing plaintext", async () => {
    const password = "test-only-shared-password";
    const hash = await Bun.password.hash(password, "argon2id");

    expect(await verifyPasswordHash(password, hash)).toBe(true);
    expect(await verifyPasswordHash("incorrect-password", hash)).toBe(false);
  });

  test("caps accepted password input length", () => {
    expect(MAX_PASSWORD_LENGTH).toBe(256);
  });
});
