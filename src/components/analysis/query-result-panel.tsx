import type { QueryResult, QueryStatus } from "./types";

type Props = Readonly<{ status: QueryStatus; result: QueryResult | null; error: string | null; queryExecutionLogId: number | null; onOpenHistory: () => void }>;

export function QueryResultPanel({ status, result, error, queryExecutionLogId, onOpenHistory }: Props) {
  return <section className="analysis-panel result-panel" aria-labelledby="result-heading">
    <header className="panel-bar"><div><span>REVIEW</span><h2 id="result-heading">SQL 실행 결과</h2></div><div className="panel-actions"><div className="result-meta">{result ? `성공 · ${result.rowCount}행 · ${result.executionMs}ms${result.truncated ? " · 제한됨" : ""}${queryExecutionLogId ? ` · 실행이력 #${queryExecutionLogId}` : ""}` : status === "error" ? "실패" : "실행 전"}</div><button type="button" className="text-button" onClick={onOpenHistory}>최근 실행</button></div></header>
    <div className="result-scroll">
      {status === "idle" && <div className="panel-empty"><strong>SQL 실행 결과가 이 영역에 표시됩니다.</strong><p>조회 행 수, 실행 시간과 결과 테이블을 확인할 수 있습니다.</p></div>}
      {status === "running" && <div className="panel-empty"><strong>쿼리를 실행하고 있습니다…</strong></div>}
      {status === "empty" && <div className="panel-empty"><strong>조회된 행이 없습니다.</strong></div>}
      {status === "error" && <div className="panel-empty panel-empty--error"><strong>쿼리 실행에 실패했습니다.</strong><p>{error}</p></div>}
      {status === "success" && result && <><table><thead><tr>{result.columns.map((column) => <th key={column.name} title={column.type}>{column.name}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td key={column.name} title={String(row[column.name] ?? "NULL")}>{row[column.name] === null ? <em>NULL</em> : String(row[column.name] ?? "")}</td>)}</tr>)}</tbody></table>{result.truncated && <p className="result-warning">최대 반환 행까지만 표시됩니다. 더 많은 결과가 있을 수 있습니다.</p>}{result.warnings.map((warning) => <p className="result-warning" key={warning}>{warning}</p>)}{result.historyWarning && <p className="result-warning">{result.historyWarning}</p>}</>}
    </div>
    <footer className="result-footer"><span>{result ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(result.executedAt)) : "실행 시각 없음"}</span><span>{result?.analysisHistoryId ? `GPT 질의 이력 #${result.analysisHistoryId} 연결됨` : "GPT 질의 이력 연결 없음"}</span></footer>
  </section>;
}
