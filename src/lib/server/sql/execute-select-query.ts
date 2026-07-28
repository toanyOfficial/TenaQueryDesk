import { serializeRows } from "./serialize-query-result";
import { safeMysqlError } from "./mysql-error";
import type { QueryExecutionResult, SqlValidationResult } from "./types";

type QueryField = { name?: string; type?: number | string };
type ExecutionConnection = { query: (options: { sql: string; timeout: number }) => Promise<[Array<Record<string, unknown>>, QueryField[]]>; release: () => void; destroy: () => void };
type ExecutionPool = { getConnection: () => Promise<ExecutionConnection> };
export class QueryExecutionError extends Error { constructor(public readonly kind: "connection" | "timeout" | "execution" | "serialization", message: string) { super(message); } }
export async function executeValidatedSelect(pool: ExecutionPool, validation: Extract<SqlValidationResult,{valid:true}>, submittedSql: string, analysisHistoryId: number | null, options: {maxRows:number;timeoutMs:number}): Promise<QueryExecutionResult> {
  let connection: ExecutionConnection; try { connection=await pool.getConnection(); } catch { throw new QueryExecutionError("connection","대상 DB 연결에 실패했습니다."); }
  const started=performance.now(); let destroyed=false;
  try {
    const [rawRows, fields] = await connection.query({ sql: validation.executedSql, timeout: options.timeoutMs });
    const truncated=rawRows.length>options.maxRows; const visible=truncated ? rawRows.slice(0,options.maxRows) : rawRows;
    const serialized=serializeRows(visible); const warnings=[...validation.warnings];
    if(truncated) warnings.push(`최대 ${options.maxRows}행까지만 반환했습니다.`); if(serialized.truncatedCells) warnings.push(`${serialized.truncatedCells}개 셀의 큰 값이 축약되었습니다.`);
    return { columns: fields.map((field,index)=>({name:field.name || `column_${index+1}`,type:String(field.type ?? "UNKNOWN")})), rows:serialized.rows, rowCount:serialized.rows.length, truncated, executionMs:Math.round(performance.now()-started), warnings, referencedTables:validation.referencedTables, submittedSql, executedSql:validation.executedSql, analysisHistoryId };
  } catch(error) { const code=error && typeof error==="object" ? (error as {code?:string}).code : undefined; if(code==="PROTOCOL_SEQUENCE_TIMEOUT") { destroyed=true; connection.destroy(); throw new QueryExecutionError("timeout","실행 제한시간을 초과했습니다."); } throw new QueryExecutionError("execution",safeMysqlError(error)); }
  finally { if(!destroyed) connection.release(); }
}
