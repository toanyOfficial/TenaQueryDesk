import { NextResponse } from "next/server";

import {
  MAX_PASSWORD_LENGTH,
  verifySharedPassword,
} from "@/lib/server/auth/password";
import { issueSessionCookie } from "@/lib/server/auth/session";

const FAILED_LOGIN_DELAY_MS = 500;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  let password: unknown;

  try {
    const body: unknown = await request.json();
    password = (body as { password?: unknown } | null)?.password;
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인 요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (
    typeof password !== "string" ||
    !password ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    await delay(FAILED_LOGIN_DELAY_MS);
    return NextResponse.json(
      { ok: false, error: "비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  try {
    if (!(await verifySharedPassword(password))) {
      await delay(FAILED_LOGIN_DELAY_MS);
      return NextResponse.json(
        { ok: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    await issueSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[auth] 로그인 설정 또는 비밀번호 검증에 실패했습니다.");
    return NextResponse.json(
      { ok: false, error: "로그인 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
