import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import { collectMysqlSchema } from "@/lib/server/schema/collect-mysql-schema";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){ if(!(await getSession())) return NextResponse.json({error:"인증이 필요합니다."},{status:401}); const id=Number((await params).id),c=await getTargetConnection(id); if(!c) return NextResponse.json({error:"연결을 찾을 수 없습니다."},{status:404}); try { const result=await collectMysqlSchema(c); return NextResponse.json({ok:true,result}); } catch { return NextResponse.json({error:"스키마 파일 생성에 실패했습니다. metadata 조회 권한을 확인해 주세요."},{status:502}); } }
