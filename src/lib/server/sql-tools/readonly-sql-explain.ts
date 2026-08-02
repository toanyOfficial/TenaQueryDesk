import type { Pool, RowDataPacket } from "mysql2/promise";
import type { TargetConnection } from "@/lib/server/db/target-connections";
import { getTargetPool } from "@/lib/server/db/target-connections";
import { validateReadonlySql } from "./readonly-sql-validator";
import { DEFAULT_SQL_TOOL_POLICY, type SqlToolPolicy } from "./sql-tool-types";
export async function explainReadonlySql(sql:string,connection:TargetConnection,policy:SqlToolPolicy=DEFAULT_SQL_TOOL_POLICY,pool:Pick<Pool,"query">=getTargetPool(connection)){
 const validation=await validateReadonlySql(sql,connection,undefined,policy);if(!validation.valid)return {safeToExecute:false,validation,plan:[],warnings:validation.errors};
 try{const [rows]=await pool.query<RowDataPacket[]>({sql:`EXPLAIN ${validation.normalizedSql}`,timeout:policy.timeoutMs});const plan=rows.map(row=>({table:String(row.table??""),accessType:String(row.type??""),possibleKeys:row.possible_keys?String(row.possible_keys).split(","):[],usedKey:row.key?String(row.key):null,estimatedRows:Number(row.rows??0),extra:String(row.Extra??"").split("; ").filter(Boolean)}));const warnings=[] as Array<{code:string;message:string}>;if(plan.some(p=>p.accessType==="ALL"))warnings.push({code:"FULL_TABLE_SCAN",message:"전체 테이블 스캔 가능성이 있습니다."});if(plan.some(p=>p.extra.some(x=>/filesort/i.test(x))))warnings.push({code:"FILESORT",message:"filesort 사용 가능성이 있습니다."});if(plan.some(p=>p.extra.some(x=>/temporary/i.test(x))))warnings.push({code:"TEMPORARY_TABLE",message:"임시 테이블 사용 가능성이 있습니다."});return {safeToExecute:!warnings.some(w=>w.code==="FULL_TABLE_SCAN"),plan,warnings,validation};}catch{return {safeToExecute:false,plan:[],warnings:[{code:"SQL_EXPLAIN_FAILED",message:"실행 계획을 확인하지 못했습니다."}],validation};}
}
