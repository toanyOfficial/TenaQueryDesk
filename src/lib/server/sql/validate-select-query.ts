import { lexSql, type SqlToken } from "./sql-lexer";
import type { SqlValidationResult } from "./types";
const FORBIDDEN = new Set(["INSERT","UPDATE","DELETE","REPLACE","CREATE","ALTER","DROP","TRUNCATE","RENAME","GRANT","REVOKE","CALL","DO","SET","USE","LOCK","UNLOCK","LOAD","HANDLER","ANALYZE","OPTIMIZE","REPAIR","FLUSH","KILL","SHUTDOWN","PREPARE","EXECUTE","DEALLOCATE","COMMIT","ROLLBACK","SAVEPOINT"]);
const SYSTEM_SCHEMAS = new Set(["INFORMATION_SCHEMA", "MYSQL", "PERFORMANCE_SCHEMA", "SYS"]);
const fail = (errorCode: string, errorMessage: string): SqlValidationResult => ({ valid: false, errorCode, errorMessage, warnings: [] });
function identifier(token?: SqlToken): string | null { return token && (token.kind === "word" || token.kind === "quoted") ? token.value : null; }
export function validateSelectQuery(input: unknown, currentDatabase: string, maxRows = 1000, maxLength = 100000): SqlValidationResult {
  if (typeof input !== "string" || !input.trim()) return fail("EMPTY_SQL", "실행할 SQL을 입력해 주세요.");
  if (input.length > maxLength) return fail("SQL_TOO_LONG", "SQL이 허용된 최대 길이를 초과했습니다.");
  if (input.includes("\0") || /[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) return fail("CONTROL_CHARACTER", "SQL에 허용되지 않는 제어문자가 포함되어 있습니다.");
  let tokens: SqlToken[]; try { tokens = lexSql(input); } catch { return fail("PARSE_ERROR", "SQL 문법 구조를 확인해 주세요."); }
  const semicolons = tokens.filter((token) => token.kind === "symbol" && token.value === ";");
  if (semicolons.length > 1 || (semicolons.length === 1 && semicolons[0] !== tokens[tokens.length - 1])) return fail("MULTIPLE_STATEMENTS", "하나의 SELECT 문만 실행할 수 있습니다.");
  const significant = tokens.filter((token) => token.value !== ";"); if (!significant.length) return fail("EMPTY_SQL", "실행할 SQL을 입력해 주세요.");
  if (!["SELECT", "WITH"].includes(significant[0].upper)) return fail("NOT_SELECT", "SELECT 쿼리만 실행할 수 있습니다.");
  const words = significant.filter((token) => token.kind === "word");
  if (words.some((token) => token.upper === "LOAD_FILE") || significant.some((token, i) => token.upper === "INTO" && ["OUTFILE","DUMPFILE"].includes(significant[i + 1]?.upper)) || significant.some((token, i) => token.upper === "FOR" && significant[i + 1]?.upper === "UPDATE") || significant.some((token, i) => token.upper === "LOCK" && significant[i + 1]?.upper === "IN")) return fail("DANGEROUS_SELECT", "파일 접근, 잠금 또는 상태 변경 SELECT는 실행할 수 없습니다.");
  if (significant.some((token) => token.kind === "word" && FORBIDDEN.has(token.upper))) return fail("FORBIDDEN_STATEMENT", "SELECT 이외의 변경 또는 관리 구문은 실행할 수 없습니다.");
  if (significant.some((token, i) => token.value === "@" || (token.upper === "INTO" && significant[i + 1]?.value === "@"))) return fail("SESSION_VARIABLE", "사용자 또는 시스템 변수는 사용할 수 없습니다.");
  const cteNames = new Set<string>(); if (significant[0].upper === "WITH") { for (let i=1;i<significant.length-1;i++) if ((i===1 || significant[i-1].value===",") && identifier(significant[i]) && significant[i+1].upper === "AS") cteNames.add(significant[i].upper); }
  const referenced = new Set<string>();
  for (let i=0;i<significant.length;i++) if (["FROM","JOIN"].includes(significant[i].upper)) { const first=identifier(significant[i+1]); if (!first || significant[i+1]?.value === "(") continue; if (significant[i+2]?.value === ".") { const second=identifier(significant[i+3]); if (!second) return fail("PARSE_ERROR", "테이블 참조를 확인해 주세요."); if (SYSTEM_SCHEMAS.has(first.toUpperCase()) || first.toLowerCase() !== currentDatabase.toLowerCase()) return fail("CROSS_DATABASE", "현재 선택한 DB 외의 스키마는 조회할 수 없습니다."); referenced.add(second); } else if (!cteNames.has(first.toUpperCase())) referenced.add(first); }
  const normalizedSql = input.trim().replace(/;\s*$/, "");
  const topLimit = significant.findIndex((token) => token.depth === 0 && token.upper === "LIMIT"); let executedSql = normalizedSql; const warnings: string[] = [];
  if (topLimit < 0) { executedSql = `${normalizedSql} LIMIT ${maxRows + 1}`; warnings.push(`서버 최대 ${maxRows}행 제한이 적용되었습니다.`); }
  else { const limitToken=significant[topLimit+1]; const comma=significant[topLimit+2]?.value === ","; const countToken=comma ? significant[topLimit+3] : limitToken; const count=Number(countToken?.value); if (!countToken || countToken.kind !== "word" || !Number.isSafeInteger(count)) return fail("UNSUPPORTED_LIMIT", "LIMIT에는 정수 상수만 사용할 수 있습니다."); if (count > maxRows + 1) { executedSql = `${input.slice(0,countToken.start)}${maxRows+1}${input.slice(countToken.end)}`.trim().replace(/;\s*$/, ""); warnings.push(`LIMIT이 서버 최대 ${maxRows}행으로 축소되었습니다.`); } }
  return { valid: true, normalizedSql, executedSql, statementType: "select", referencedTables: [...referenced], warnings };
}
