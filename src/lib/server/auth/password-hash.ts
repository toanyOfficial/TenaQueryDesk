export const MAX_PASSWORD_LENGTH = 256;

export async function verifyPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
