import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;
const textEncoder = new TextEncoder();

export class DbCredentialEncryptionError extends Error {
  constructor(message = "DB 자격증명을 처리할 수 없습니다.") {
    super(message);
    this.name = "DbCredentialEncryptionError";
  }
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== KEY_BYTES) {
    throw new DbCredentialEncryptionError(
      "DB 자격증명 암호화 키는 32바이트여야 합니다.",
    );
  }
}

function encode(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

export function encryptDbCredential(
  plaintext: string,
  key: Uint8Array,
): string {
  if (!plaintext) {
    throw new DbCredentialEncryptionError("빈 DB 자격증명은 암호화할 수 없습니다.");
  }

  assertKey(key);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(textEncoder.encode(FORMAT_VERSION));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [FORMAT_VERSION, encode(iv), encode(authTag), encode(ciphertext)].join(":");
}

export function decryptDbCredential(
  encryptedValue: string,
  key: Uint8Array,
): string {
  assertKey(key);

  const parts = encryptedValue.split(":");

  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new DbCredentialEncryptionError();
  }

  const iv = decode(parts[1]);
  const authTag = decode(parts[2]);
  const ciphertext = decode(parts[3]);

  if (
    !iv ||
    !authTag ||
    !ciphertext ||
    iv.byteLength !== IV_BYTES ||
    authTag.byteLength !== AUTH_TAG_BYTES ||
    ciphertext.byteLength === 0
  ) {
    throw new DbCredentialEncryptionError();
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(textEncoder.encode(FORMAT_VERSION));
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DbCredentialEncryptionError();
  }
}
