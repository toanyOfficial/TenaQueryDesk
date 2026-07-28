import "server-only";

import {
  decryptDbCredential,
  encryptDbCredential,
} from "@/lib/server/crypto/db-credentials-codec";
import { getDbCredentialEncryptionEnvironment } from "@/lib/server/env";

export function encryptTargetDbPassword(plaintext: string): string {
  const { key } = getDbCredentialEncryptionEnvironment();
  return encryptDbCredential(plaintext, key);
}

export function decryptTargetDbPassword(encryptedValue: string): string {
  const { key } = getDbCredentialEncryptionEnvironment();
  return decryptDbCredential(encryptedValue, key);
}
