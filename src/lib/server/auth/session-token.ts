export const SESSION_DURATION_SECONDS = 12 * 60 * 60;

export type AuthSession = Readonly<{
  authenticated: true;
  issuedAt: number;
  expiresAt: number;
}>;

const encoder = new TextEncoder();

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    return Uint8Array.from(Buffer.from(value, "base64url"));
  } catch {
    return null;
  }
}

async function createHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function isAuthSession(value: unknown, now: number): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    session.authenticated === true &&
    Number.isInteger(session.issuedAt) &&
    Number.isInteger(session.expiresAt) &&
    session.issuedAt! <= now + 60 &&
    session.expiresAt! > now &&
    session.expiresAt! > session.issuedAt! &&
    session.expiresAt! - session.issuedAt! <= SESSION_DURATION_SECONDS
  );
}

export async function createSessionToken(
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<{ token: string; session: AuthSession }> {
  const session: AuthSession = Object.freeze({
    authenticated: true,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_SECONDS,
  });
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(session)));
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return {
    token: `${payload}.${encodeBase64Url(new Uint8Array(signature))}`,
    session,
  };
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<AuthSession | null> {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, encodedSignature] = parts;
  const signature = decodeBase64Url(encodedSignature);

  if (!payload || !signature) {
    return null;
  }

  try {
    const key = await createHmacKey(secret);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(payload),
    );

    if (!isValid) {
      return null;
    }

    const encodedPayload = decodeBase64Url(payload);

    if (!encodedPayload) {
      return null;
    }

    const parsed: unknown = JSON.parse(new TextDecoder().decode(encodedPayload));
    return isAuthSession(parsed, now) ? Object.freeze(parsed) : null;
  } catch {
    return null;
  }
}
