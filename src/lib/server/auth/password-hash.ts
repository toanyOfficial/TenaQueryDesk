import { verify } from "@node-rs/argon2";

export const MAX_PASSWORD_LENGTH = 256;

export async function verifyPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  return verify(hash, password);
}
