import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/server/auth/session";
import {assertSameOrigin,securityErrorResponse} from "@/lib/server/security/request-security";

export async function POST(request:Request) {
  try{assertSameOrigin(request);}catch(error){return securityErrorResponse(error,NextResponse);}
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
