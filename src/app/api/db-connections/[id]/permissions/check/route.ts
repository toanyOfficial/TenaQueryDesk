import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { createTargetPool, getTargetConnection } from "@/lib/server/db/target-connections";
import { checkMysqlPermissions } from "@/lib/server/db/permissions/check-mysql-permissions";
import { toPublicPermissionSummary } from "@/lib/server/db/permissions/public-summary";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ ok: false, errorCode: "AUTHENTICATION", error: "인증이 필요합니다." }, { status: 401 });
  const connectionId = Number((await context.params).id);
  if (!Number.isSafeInteger(connectionId) || connectionId < 1) return NextResponse.json({ ok: false, errorCode: "INVALID_CONNECTION", error: "대상 DB 연결 ID를 확인해 주세요." }, { status: 400 });
  const target=await getTargetConnection(connectionId);
  if(!target) return NextResponse.json({ok:false,error:"대상 DB 연결을 찾을 수 없습니다."},{status:404});
  const pool=createTargetPool(target); const connection=await pool.getConnection();
  try { const result=await checkMysqlPermissions({query:async(sql,values)=>connection.query(sql,[...(values??[])]) as never},connectionId,target.databaseName); return NextResponse.json({ok:true,permissions:toPublicPermissionSummary(result)}); }
  catch { return NextResponse.json({ok:false,error:"권한 점검에 실패했습니다."},{status:502}); }
  finally { connection.release(); await pool.end(); }
}
