import {NextResponse} from "next/server";
import {listSecurityAudit} from "@/lib/server/security/security-audit-service";
import {requireSecurityAdmin,securityErrorResponse} from "@/lib/server/security/request-security";
export async function GET(request:Request){try{await requireSecurityAdmin();const limit=Number(new URL(request.url).searchParams.get("limit")??100);return NextResponse.json({ok:true,items:await listSecurityAudit(Number.isSafeInteger(limit)?limit:100)},{headers:{"Cache-Control":"no-store"}});}catch(error){return securityErrorResponse(error,NextResponse);}}
