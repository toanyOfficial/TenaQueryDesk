import "server-only";
import type {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth/session";
import {getSecurityActor} from "./permission-repository";
import {SecurityError} from "./security-errors";
export async function getAuthenticatedSecurityActor(){const session=await getSession();if(!session)throw new SecurityError("AUTHENTICATION_REQUIRED");const actor=await getSecurityActor("shared-user");if(!actor.active)throw new SecurityError("USER_DISABLED");return{...actor,authenticatedAt:session.issuedAt};}
export async function requireSecurityAdmin(){const actor=await getAuthenticatedSecurityActor();if(!actor.roles.includes("security_admin"))throw new SecurityError("ACTION_NOT_ALLOWED");return actor;}
export function assertSameOrigin(request:Request){if(!["POST","PUT","PATCH","DELETE"].includes(request.method))return;const origin=request.headers.get("origin"),host=request.headers.get("host");if(!origin||!host){if(process.env.NODE_ENV==="production")throw new SecurityError("SESSION_SECURITY_VIOLATION");return;}let parsed:URL;try{parsed=new URL(origin);}catch{throw new SecurityError("SESSION_SECURITY_VIOLATION");}if(parsed.host!==host)throw new SecurityError("SESSION_SECURITY_VIOLATION");}
export function securityErrorResponse(error:unknown,Next:typeof NextResponse){if(error instanceof SecurityError)return Next.json({ok:false,error:{code:error.code,message:error.message,retryable:error.retryable}},{status:error.code.startsWith("AUTHENTICATION")?401:403});return Next.json({ok:false,error:{code:"SECURITY_POLICY_EVALUATION_FAILED",message:"보안 정책을 처리하지 못했습니다.",retryable:false}},{status:500});}
