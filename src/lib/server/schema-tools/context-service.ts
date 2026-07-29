import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCurrentSchemaBundle } from "@/lib/server/schema/select-schema";
import type { SchemaCurrentPointer } from "@/lib/server/schema/types";
import type { TargetConnection } from "@/lib/server/db/target-connections";
import { LoadedSchemaContext, SchemaToolError } from "./types";

export async function loadSchemaContext(connection:TargetConnection|null,root=process.cwd()):Promise<LoadedSchemaContext>{
  if(!connection)throw new SchemaToolError("CONNECTION_NOT_SELECTED","선택된 대상 DB가 없습니다.",false);
  let pointer:SchemaCurrentPointer|null=null;
  try{pointer=JSON.parse(await readFile(path.join(root,"schemas",connection.connectionKey,"current.json"),"utf8")) as SchemaCurrentPointer;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw new SchemaToolError("SCHEMA_FILE_CORRUPTED","현재 스키마 버전 정보가 손상되었습니다.",false);}
  if(pointer&&(pointer.connectionId!==connection.id||pointer.connectionKey!==connection.connectionKey||!Number.isSafeInteger(pointer.latestVersion)||pointer.latestVersion<1||!/^versions\/v\d{6}$/.test(pointer.path)||!/^[0-9a-f]{64}$/.test(pointer.schemaHash)))throw new SchemaToolError("SCHEMA_FILE_CORRUPTED","현재 스키마 버전 정보가 올바르지 않습니다.",false);
  let bundle;try{bundle=await loadCurrentSchemaBundle(connection.connectionKey,root);}catch(error){const code=(error as NodeJS.ErrnoException).code;if(code==="ENOENT")throw new SchemaToolError(pointer?"SCHEMA_VERSION_NOT_FOUND":"SCHEMA_NOT_GENERATED",pointer?"현재 포인터가 가리키는 스키마 버전을 찾을 수 없습니다.":"선택된 DB의 스키마가 생성되지 않았습니다. 관리자 화면에서 스키마를 생성해 주세요.",false);throw new SchemaToolError("SCHEMA_FILE_CORRUPTED","최신 스키마 파일을 안전하게 읽을 수 없습니다. 관리자 화면에서 다시 생성해 주세요.",false);}
  if(bundle.manifest.connectionId!==connection.id||bundle.manifest.connectionKey!==connection.connectionKey)throw new SchemaToolError("SCHEMA_FILE_CORRUPTED","스키마 파일이 선택된 DB와 일치하지 않습니다.",false);
  const version=pointer?.latestVersion??null;
  return {connection,bundle,version,versionLabel:version===null?"legacy-flat":`v${String(version).padStart(6,"0")}`,schemaHash:pointer?.schemaHash??null,generatedAt:bundle.manifest.generatedAt,previousVersionExists:version!==null&&version>1};
}
