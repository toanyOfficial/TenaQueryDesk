import {NextResponse} from "next/server";
import {requireSecurityAdmin,securityErrorResponse} from "@/lib/server/security/request-security";
import {getQualityStatus} from "@/lib/server/quality/quality-status-service";
import {disabledCapabilities} from "@/lib/server/features/feature-flags";
export async function GET(){try{await requireSecurityAdmin();const status=await getQualityStatus();return NextResponse.json({ok:true,status:{...status,disabledCapabilities:disabledCapabilities()}},{headers:{"Cache-Control":"no-store"}});}catch(error){return securityErrorResponse(error,NextResponse);}}
