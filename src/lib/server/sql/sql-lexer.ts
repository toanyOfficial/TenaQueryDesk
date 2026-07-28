export type SqlToken = Readonly<{ kind: "word" | "quoted" | "string" | "symbol"; value: string; upper: string; start: number; end: number; depth: number }>;
export function lexSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []; let index = 0; let depth = 0;
  const push = (kind: SqlToken["kind"], value: string, start: number, end: number, tokenDepth = depth) => tokens.push({ kind, value, upper: value.toUpperCase(), start, end, depth: tokenDepth });
  while (index < sql.length) {
    const char = sql[index];
    if (/\s/.test(char)) { index++; continue; }
    if (char === "#" || (char === "-" && sql[index + 1] === "-" && /\s/.test(sql[index + 2] ?? " "))) { while (index < sql.length && sql[index] !== "\n") index++; continue; }
    if (char === "/" && sql[index + 1] === "*") { const close = sql.indexOf("*/", index + 2); if (close < 0) throw new Error("종료되지 않은 SQL 주석입니다."); index = close + 2; continue; }
    if (char === "'" || char === '"' || char === "`") { const start = index; const quote = char; index++; let value = ""; let closed = false; while (index < sql.length) { if (sql[index] === "\\" && quote !== "`") { value += sql.slice(index, index + 2); index += 2; continue; } if (sql[index] === quote) { if (sql[index + 1] === quote) { value += quote; index += 2; continue; } index++; closed = true; break; } value += sql[index++]; } if (!closed) throw new Error("종료되지 않은 SQL 문자열입니다."); push(quote === "`" ? "quoted" : "string", value, start, index); continue; }
    if (/[A-Za-z0-9_$\p{L}]/u.test(char)) { const start = index++; while (index < sql.length && /[A-Za-z0-9_$\p{L}]/u.test(sql[index])) index++; push("word", sql.slice(start, index), start, index); continue; }
    if (char === "(") { push("symbol", char, index, index + 1); depth++; index++; continue; }
    if (char === ")") { depth--; if (depth < 0) throw new Error("SQL 괄호가 올바르지 않습니다."); push("symbol", char, index, index + 1, depth); index++; continue; }
    push("symbol", char, index, index + 1); index++;
  }
  if (depth !== 0) throw new Error("SQL 괄호가 올바르지 않습니다.");
  return tokens;
}
