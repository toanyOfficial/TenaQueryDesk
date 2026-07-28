import "server-only";

import { cookies } from "next/headers";

import { getAuthEnvironment } from "@/lib/server/env";
import {
  createSessionToken,
  SESSION_DURATION_SECONDS,
  type AuthSession,
  verifySessionToken,
} from "@/lib/server/auth/session-token";

export const SESSION_COOKIE_NAME = "tena_query_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function issueSessionCookie(): Promise<void> {
  const { sessionSecret } = getAuthEnvironment();
  const { token, session } = await createSessionToken(sessionSecret);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    expires: new Date(session.expiresAt * 1000),
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { sessionSecret } = getAuthEnvironment();
    return await verifySessionToken(token, sessionSecret);
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}
