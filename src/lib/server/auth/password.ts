import "server-only";

import {
  MAX_PASSWORD_LENGTH,
  verifyPasswordHash,
} from "@/lib/server/auth/password-hash";
import { getAuthEnvironment } from "@/lib/server/env";

export { MAX_PASSWORD_LENGTH } from "@/lib/server/auth/password-hash";

export async function verifySharedPassword(password: string): Promise<boolean> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  const { passwordHash } = getAuthEnvironment();
  return verifyPasswordHash(password, passwordHash);
}
