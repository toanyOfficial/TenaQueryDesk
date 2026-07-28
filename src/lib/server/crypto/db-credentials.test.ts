import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

import {
  DbCredentialEncryptionError,
  decryptDbCredential,
  encryptDbCredential,
} from "./db-credentials-codec";

describe("target database credential encryption", () => {
  const key = randomBytes(32);

  test("encrypts UTF-8 credentials and decrypts them losslessly", () => {
    const plaintext = "테스트 전용 DB 비밀번호 !@#";
    const encrypted = encryptDbCredential(plaintext, key);

    expect(encrypted).toStartWith("v1:");
    expect(encrypted).not.toContain(plaintext);
    expect(decryptDbCredential(encrypted, key)).toBe(plaintext);
  });

  test("uses a fresh IV for every encryption", () => {
    const first = encryptDbCredential("same-test-value", key);
    const second = encryptDbCredential("same-test-value", key);

    expect(first).not.toBe(second);
  });

  test("rejects tampered ciphertext and a different key", () => {
    const encrypted = encryptDbCredential("test-value", key);
    const parts = encrypted.split(":");
    parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    const tampered = parts.join(":");

    expect(() => decryptDbCredential(tampered, key)).toThrow(
      DbCredentialEncryptionError,
    );
    expect(() => decryptDbCredential(encrypted, randomBytes(32))).toThrow(
      DbCredentialEncryptionError,
    );
  });

  test("rejects invalid formats, empty values, and invalid key lengths", () => {
    expect(() => encryptDbCredential("", key)).toThrow(
      DbCredentialEncryptionError,
    );
    expect(() => decryptDbCredential("plaintext", key)).toThrow(
      DbCredentialEncryptionError,
    );
    expect(() => encryptDbCredential("test", randomBytes(16))).toThrow(
      "32바이트",
    );
  });
});
