import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tableFileName, writeVersionedSchemaFiles } from "./write-schema-files";
import { calculateSchemaHash } from "./schema-hash";
import { publishCurrentSchema } from "./schema-current";
import type { SchemaCurrentPointer } from "./types";
import type { SchemaBundle, TableSchema } from "./types";
import { createTargetPool, type TargetConnection } from "../db/target-connections";

export async function collectMysqlSchema(c:TargetConnection){
 const pool=createTargetPool(c); const generatedAt=new Date().toISOString();
 try {
  const [tables]=await pool.query<RowDataPacket[]>(`SELECT TABLE_NAME,TABLE_TYPE,TABLE_COMMENT,ENGINE,TABLE_COLLATION,TABLE_ROWS,CREATE_TIME,UPDATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME`,[c.databaseName]);
  const [columns]=await pool.query<RowDataPacket[]>(`SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,DATA_TYPE,COLUMN_TYPE,CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,DATETIME_PRECISION,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME,COLUMN_COMMENT,COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION`,[c.databaseName]);
  const docs=tables.map(t=>{ const cs=columns.filter(x=>x.TABLE_NAME===t.TABLE_NAME).map(x=>({ordinalPosition:Number(x.ORDINAL_POSITION),name:x.COLUMN_NAME,dataType:x.DATA_TYPE,columnType:x.COLUMN_TYPE,characterMaximumLength:x.CHARACTER_MAXIMUM_LENGTH===null?null:Number(x.CHARACTER_MAXIMUM_LENGTH),numericPrecision:x.NUMERIC_PRECISION===null?null:Number(x.NUMERIC_PRECISION),numericScale:x.NUMERIC_SCALE===null?null:Number(x.NUMERIC_SCALE),datetimePrecision:x.DATETIME_PRECISION===null?null:Number(x.DATETIME_PRECISION),nullable:x.IS_NULLABLE==="YES",defaultValue:x.COLUMN_DEFAULT===null?null:String(x.COLUMN_DEFAULT),extra:x.EXTRA||"",generated:Boolean(x.GENERATION_EXPRESSION),generationExpression:x.GENERATION_EXPRESSION||null,characterSet:x.CHARACTER_SET_NAME,collation:x.COLLATION_NAME,comment:x.COLUMN_COMMENT||"",primaryKey:x.COLUMN_KEY==="PRI",uniqueIndex:x.COLUMN_KEY==="UNI",indexed:Boolean(x.COLUMN_KEY),foreignKey:false,referencedTable:null,referencedColumn:null})); const table:TableSchema={name:t.TABLE_NAME,type:t.TABLE_TYPE,comment:t.TABLE_COMMENT||"",engine:t.ENGINE,characterSet:t.TABLE_COLLATION?.split("_")[0]||null,collation:t.TABLE_COLLATION,estimatedRows:t.TABLE_ROWS===null?null:Number(t.TABLE_ROWS),createdAt:t.CREATE_TIME?new Date(t.CREATE_TIME).toISOString():null,updatedAt:t.UPDATE_TIME?new Date(t.UPDATE_TIME).toISOString():null,columns:cs,primaryKey:cs.filter(x=>x.primaryKey).map(x=>x.name),foreignKeys:[],indexes:[],view:null}; return {formatVersion:1 as const,databaseName:c.databaseName,table}; });
  const manifestTables=docs.map(d=>({name:d.table.name,type:d.table.type,comment:d.table.comment,columnCount:d.table.columns.length,primaryKey:d.table.primaryKey,foreignKeyCount:0,indexCount:0,file:`tables/${tableFileName(d.table.name)}`}));
  const bundle:SchemaBundle={manifest:{formatVersion:1,connectionId:c.id,connectionKey:c.connectionKey,displayName:c.displayName,dbType:"mysql",databaseName:c.databaseName,generatedAt,tableCount:docs.filter(x=>x.table.type==="BASE TABLE").length,viewCount:docs.filter(x=>x.table.type==="VIEW").length,tables:manifestTables},relationships:{formatVersion:1,generatedAt,relationships:[]},tables:docs};
  let versionNo=1;
  try { const current=JSON.parse(await readFile(path.join(process.cwd(),"schemas",c.connectionKey,"current.json"),"utf8")) as SchemaCurrentPointer; versionNo=current.latestVersion+1; } catch (error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
  const schemaHash=calculateSchemaHash(bundle);
  const result=await writeVersionedSchemaFiles(bundle,versionNo);
  await publishCurrentSchema({formatVersion:1,connectionId:c.id,connectionKey:c.connectionKey,latestVersion:versionNo,path:`versions/v${String(versionNo).padStart(6,"0")}`,generatedAt,schemaHash});
  return {...result,versionNo,schemaHash};
 } finally { await pool.end(); }
}
