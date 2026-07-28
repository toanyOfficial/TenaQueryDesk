import { describe, expect, test } from "bun:test";

import {
  createSessionToken,
  SESSION_DURATION_SECONDS,
  verifySessionToken,
} from "./session-token";

const TEST_SECRET = "test-only-session-secret-with-32-characters";
const NOW = 1_750_000_000;

describe("signed auth session", () => {
  test("creates and verifies a minimal 12-hour session", async () => {
    const { token, session } = await createSessionToken(TEST_SECRET, NOW);

    expect(session).toEqual({
      authenticated: true,
      issuedAt: NOW,
      expiresAt: NOW + SESSION_DURATION_SECONDS,
    });
    expect(await verifySessionToken(token, TEST_SECRET, NOW)).toEqual(session);
  });

  test("rejects a token signed with another secret", async () => {
    const { token } = await createSessionToken(TEST_SECRET, NOW);
    expect(await verifySessionToken(token, `${TEST_SECRET}-other`, NOW)).toBeNull();
  });

  test("rejects modified and malformed tokens", async () => {
    const { token } = await createSessionToken(TEST_SECRET, NOW);
    const [payload, signature] = token.split(".");

    expect(
      await verifySessionToken(`${payload}x.${signature}`, TEST_SECRET, NOW),
    ).toBeNull();
    expect(await verifySessionToken("not-a-session", TEST_SECRET, NOW)).toBeNull();
  });

  test("rejects an expired token", async () => {
    const { token } = await createSessionToken(TEST_SECRET, NOW);
    expect(
      await verifySessionToken(
        token,
        TEST_SECRET,
        NOW + SESSION_DURATION_SECONDS,
      ),
    ).toBeNull();
  });
});
