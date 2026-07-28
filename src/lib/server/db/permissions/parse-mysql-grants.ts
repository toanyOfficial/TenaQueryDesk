import { ADMIN_PRIVILEGES, ALLOWED_PRIVILEGES, DATA_CHANGE_PRIVILEGES, KNOWN_PRIVILEGES, SCHEMA_CHANGE_PRIVILEGES } from "./permission-policy";
import type { DbPermissionCheckResult, HostRestriction, ParsedGrant } from "./types";

const unquote = (value: string) => value.trim().replace(/^`|`$/g, "").replace(/``/g, "`");
export function parseMysqlGrant(raw: string): ParsedGrant {
  const text = raw.trim(), match = /^GRANT\s+(.+?)\s+ON\s+((?:`(?:``|[^`])+`|\*)\.(?:`(?:``|[^`])+`|\*))\s+TO\s+/i.exec(text);
  if (!match) return { raw, privileges: [], scope: null, database: null, global: false, roleGrant: /^GRANT\s+.+\s+TO\s+/i.test(text), parseable: false };
  const privileges = match[1].split(",").map(value => value.trim().replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+/g, " ").toUpperCase());
  if (/\bWITH\s+GRANT\s+OPTION\b/i.test(text)) privileges.push("GRANT OPTION");
  const [database] = match[2].split(".");
  return { raw, privileges: [...new Set(privileges)], scope: match[2], database: database === "*" ? null : unquote(database), global: match[2] === "*.*", roleGrant: false, parseable: true };
}
function accountHost(currentUser: string | null): { host: string | null; restriction: HostRestriction } {
  if (!currentUser || !currentUser.includes("@")) return { host: null, restriction: "unknown" };
  const host = currentUser.slice(currentUser.lastIndexOf("@") + 1).replace(/^['`]|['`]$/g, "");
  if (host === "%") return { host, restriction: "wildcard" };
  if (host.includes("%") || host.includes("_")) return { host, restriction: "review" };
  return { host, restriction: "restricted" };
}
export function assessMysqlGrants(input: { connectionId: number; targetDatabase: string; currentUser: string | null; loginUser: string | null; grants: ReadonlyArray<string>; metadataReadable?: boolean | null }): DbPermissionCheckResult {
  const parsed=input.grants.map(parseMysqlGrant), privileges=[...new Set(parsed.flatMap(grant=>grant.privileges))];
  const allowed=privileges.filter(privilege=>ALLOWED_PRIVILEGES.has(privilege)), risky=privileges.filter(privilege=>DATA_CHANGE_PRIVILEGES.has(privilege)||SCHEMA_CHANGE_PRIVILEGES.has(privilege)||ADMIN_PRIVILEGES.has(privilege)), unknown=privileges.filter(privilege=>!KNOWN_PRIVILEGES.has(privilege));
  const hasGlobal=parsed.some(grant=>grant.global), hasCross=parsed.some(grant=>grant.database!==null&&grant.database.toLowerCase()!==input.targetDatabase.toLowerCase()), targetSelect=parsed.some(grant=>grant.privileges.includes("SELECT")&&(grant.global||grant.database?.toLowerCase()===input.targetDatabase.toLowerCase()));
  const host=accountHost(input.currentUser), unparsed=parsed.some(grant=>!grant.parseable), role=parsed.some(grant=>grant.roleGrant), reasons:string[]=[], recommendations:string[]=[];
  if (!targetSelect) reasons.push("대상 DB의 SELECT 권한을 확인하지 못했습니다."); if (risky.length) reasons.push(`쓰기·DDL·관리 위험 권한 ${risky.length}개가 있습니다.`); if (hasGlobal) reasons.push("전역 범위 권한이 있습니다."); if (hasCross) reasons.push("다른 DB 범위 권한이 있습니다."); if (host.restriction==="wildcard") reasons.push("계정 host에 '%' 와일드카드가 사용됩니다."); if (host.restriction==="review") reasons.push("계정 host 범위를 수동 확인해야 합니다."); if (unknown.length||unparsed||role) reasons.push("알 수 없거나 역할 기반인 권한은 별도 확인이 필요합니다.");
  if (risky.length) recommendations.push("DBA가 쓰기·DDL·관리 권한을 제거한 전용 계정으로 교체하세요."); if (hasGlobal||hasCross) recommendations.push("SELECT 범위를 현재 대상 DB로 제한하세요."); if (host.restriction!=="restricted") recommendations.push("접속 host를 분석 서버 IP 또는 제한된 내부 대역으로 제한하세요."); if (!allowed.includes("SHOW VIEW")) recommendations.push("View 정의 수집이 필요하면 SHOW VIEW 최소 권한을 검토하세요.");
  const critical=risky.length>0, uncertain=unparsed||role||unknown.length>0, warning=!critical&&(hasGlobal||hasCross||host.restriction!=="restricted"||!targetSelect), riskLevel=critical?"critical":uncertain?"unknown":warning?"warning":"safe";
  return { connectionId:input.connectionId,dbType:"mysql",checkedAt:new Date().toISOString(),authenticatedAccount:{currentUser:input.currentUser,loginUser:input.loginUser,hostPattern:host.host,hostRestriction:host.restriction},grants:[...input.grants],allowedPrivileges:allowed,riskyPrivileges:risky,unknownPrivileges:unknown,scope:{targetDatabase:input.targetDatabase,hasTargetDatabaseSelect:targetSelect,hasGlobalPrivileges:hasGlobal,hasCrossDatabasePrivileges:hasCross},schemaAccess:{metadataReadable:input.metadataReadable??null,viewDefinitionLikelyReadable:allowed.includes("SHOW VIEW"),warnings:input.metadataReadable===false?["기본 조회는 가능할 수 있지만 일부 스키마 metadata 접근이 제한됩니다."]:!allowed.includes("SHOW VIEW")?["View 정의 수집 권한을 확인하지 못했습니다."]:[]},readOnlyAssessment:{isReadOnly:riskLevel==="safe",riskLevel,reasons,recommendations} };
}
