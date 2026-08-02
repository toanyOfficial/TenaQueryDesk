import {NextResponse} from "next/server";
import {listSecurityUsers} from "@/lib/server/security/permission-repository";
import {requireSecurityAdmin,securityErrorResponse} from "@/lib/server/security/request-security";
export async function GET(){try{await requireSecurityAdmin();return NextResponse.json({ok:true,items:await listSecurityUsers()},{headers:{"Cache-Control":"no-store"}});}catch(error){return securityErrorResponse(error,NextResponse);}}
