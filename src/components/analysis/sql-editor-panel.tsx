import type { DatabaseOption } from "./types";

type Props = Readonly<{ database: DatabaseOption | null; sql: string; running: boolean; onChange: (sql: string) => void; onClear: () => void; onExecute: () => void }>;

export function SqlEditorPanel({ database, sql, running, onChange, onClear, onExecute }: Props) {
  async function copySql() { if (sql) await navigator.clipboard.writeText(sql).catch(() => undefined); }
  return <section className="analysis-panel editor-panel" aria-labelledby="editor-heading">
    <header className="panel-bar"><div><span>WRITE</span><h2 id="editor-heading">SQL 편집기</h2></div><div className="panel-actions"><button type="button" className="text-button" onClick={copySql} disabled={!sql}>복사</button><button type="button" className="text-button" onClick={onClear} disabled={!sql || running}>초기화</button><button type="button" className="execute-button" onClick={onExecute} disabled={!database || !sql.trim() || running}>{running ? "실행 중…" : "실행"} <kbd>F5</kbd></button></div></header>
    <div className="panel-context"><strong>{database?.displayName ?? "DB 미선택"}</strong><span>사이트에서는 검증된 SELECT 계열 쿼리만 실행할 예정입니다.</span></div>
    <label className="sr-only" htmlFor="sql-editor">SQL 쿼리 편집</label>
    <textarea id="sql-editor" className="sql-editor" value={sql} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "F5") { event.preventDefault(); onExecute(); return; } if (event.key !== "Tab") return; event.preventDefault(); const target = event.currentTarget; const next = `${sql.slice(0, target.selectionStart)}  ${sql.slice(target.selectionEnd)}`; const cursor = target.selectionStart + 2; onChange(next); requestAnimationFrame(() => target.setSelectionRange(cursor, cursor)); }} spellCheck={false} placeholder="GPT가 생성한 SQL 또는 직접 작성한 SELECT 쿼리가 표시됩니다." />
    <footer className="editor-footer"><span>{sql ? `${sql.split("\n").length} lines · ${sql.length} chars` : "SQL 없음"}</span><span>실행 기능은 Step 10에서 연결됩니다.</span></footer>
  </section>;
}
