import { NextResponse } from "next/server";
import {createHash} from "node:crypto";

import {
  MAX_PASSWORD_LENGTH,
  verifySharedPassword,
} from "@/lib/server/auth/password";
import { issueSessionCookie } from "@/lib/server/auth/session";
import {consumeSecurityRateLimit} from "@/lib/server/security/rate-limit-service";
import {SecurityError} from "@/lib/server/security/security-errors";
import {writeSecurityAudit} from "@/lib/server/security/security-audit-service";

const FAILED_LOGIN_DELAY_MS = 500;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: Request) {
  const ip=(request.headers.get("x-forwarded-for")?.split(",")[0]??request.headers.get("x-real-ip")??"unknown").trim().slice(0,64),ipHash=createHash("sha256").update(ip).digest("hex").slice(0,16);try{consumeSecurityRateLimit({userId:`login:${ipHash}`,organizationId:"anonymous",toolName:"login",resourceId:null,riskLevel:"high"});}catch(error){if(error instanceof SecurityError)return NextResponse.json({ok:false,error:error.message,errorCode:error.code},{status:429});throw error;}
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
      await writeSecurityAudit({eventType:"login_failed",severity:"warning",userId:null,organizationId:null,decision:"deny",reasonCode:"INVALID_CREDENTIAL",metadata:{ipHash}}).catch(()=>undefined);
      await delay(FAILED_LOGIN_DELAY_MS);
      return NextResponse.json(
        { ok: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    await issueSessionCookie();
    await writeSecurityAudit({eventType:"login_succeeded",severity:"info",userId:"shared-user",organizationId:"default",decision:"allow",reasonCode:"AUTHENTICATED",metadata:{ipHash}}).catch(()=>undefined);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[auth] 로그인 설정 또는 비밀번호 검증에 실패했습니다.");
    return NextResponse.json(
      { ok: false, error: "로그인 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
