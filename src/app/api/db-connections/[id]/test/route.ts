import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { testTargetConnection } from "@/lib/server/db/target-connections";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){ if(!(await getSession())) return NextResponse.json({error:"인증이 필요합니다."},{status:401}); const id=Number((await params).id); if(!Number.isSafeInteger(id)||id<1) return NextResponse.json({error:"잘못된 연결입니다."},{status:400}); try { await testTargetConnection(id); return NextResponse.json({ok:true}); } catch { return NextResponse.json({error:"대상 DB 연결에 실패했습니다."},{status:502}); } }
