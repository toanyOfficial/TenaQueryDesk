import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth/session";
import { getTargetConnection } from "@/lib/server/db/target-connections";
import type { SchemaCurrentPointer, SchemaManifest } from "@/lib/server/schema/types";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
  if(!(await getSession())) return NextResponse.json({error:"인증이 필요합니다."},{status:401});
  const id=Number((await params).id), connection=await getTargetConnection(id);
  if(!connection) return NextResponse.json({error:"연결을 찾을 수 없습니다."},{status:404});
  const root=path.join(process.cwd(),"schemas",connection.connectionKey);
  try {
    let versionNo=1, schemaHash:string|null=null, directory=root;
    try {
      const pointer=JSON.parse(await readFile(path.join(root,"current.json"),"utf8")) as SchemaCurrentPointer;
      versionNo=pointer.latestVersion; schemaHash=pointer.schemaHash; directory=path.join(root,pointer.path);
    } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
    const manifest=JSON.parse(await readFile(path.join(directory,"manifest.json"),"utf8")) as SchemaManifest;
    return NextResponse.json({latest:{connectionId:id,versionNo,status:"success",generatedAt:manifest.generatedAt,tableCount:manifest.tableCount,viewCount:manifest.viewCount,schemaHash,filesPresent:true}});
  } catch {
    return NextResponse.json({latest:{connectionId:id,versionNo:null,status:"missing",generatedAt:null,tableCount:null,viewCount:null,schemaHash:null,filesPresent:false}});
  }
}
