import "server-only";
import { assessMysqlGrants } from "./parse-mysql-grants";
import type { DbPermissionCheckResult } from "./types";
type Rows = ReadonlyArray<Record<string, unknown>>;
export type PermissionConnection = { query(sql: string, values?: ReadonlyArray<unknown>): Promise<[Rows, unknown]> };
export async function checkMysqlPermissions(connection: PermissionConnection, connectionId: number, targetDatabase: string): Promise<DbPermissionCheckResult> {
  const [accounts] = await connection.query("SELECT CURRENT_USER() AS currentUser, USER() AS loginUser");
  const [grantRows] = await connection.query("SHOW GRANTS FOR CURRENT_USER()");
  let metadataReadable: boolean | null = null;
  try { await connection.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? LIMIT 1", [targetDatabase]); metadataReadable=true; } catch { metadataReadable=false; }
  const row=accounts[0]??{}, grants=grantRows.flatMap(item=>Object.values(item)).filter((value):value is string=>typeof value==="string");
  return assessMysqlGrants({ connectionId,targetDatabase,currentUser:typeof row.currentUser==="string"?row.currentUser:null,loginUser:typeof row.loginUser==="string"?row.loginUser:null,grants,metadataReadable });
}
