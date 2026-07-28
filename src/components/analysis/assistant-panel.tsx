import type { AnalysisMessage, DatabaseOption } from "./types";

type Props = Readonly<{ database: DatabaseOption | null; messages: ReadonlyArray<AnalysisMessage>; question: string; disabled: boolean; submitting: boolean; error: string | null; notice: string | null; onQuestionChange: (value: string) => void; onClear: () => void; onSubmit: () => void; onOpenHistory: () => void }>;

export function AssistantPanel({ database, messages, question, disabled, submitting, error, notice, onQuestionChange, onClear, onSubmit, onOpenHistory }: Props) {
  return <section className="analysis-panel assistant-panel" aria-labelledby="assistant-heading">
    <header className="panel-bar"><div><span>ASK</span><h2 id="assistant-heading">GPT 질문 및 답변</h2></div><div className="panel-actions"><button type="button" className="text-button" onClick={onOpenHistory} disabled={!database}>최근 질문</button><button type="button" className="text-button" onClick={onClear} disabled={messages.length === 0}>대화 초기화</button></div></header>
    <div className="panel-context">{database ? `${database.displayName} 스키마 기준` : "대상 DB를 먼저 선택하세요"}</div>
    <div className="message-list" aria-live="polite">
      {messages.length === 0 ? <div className="panel-empty"><strong>조회하려는 내용을 입력하세요.</strong><p>선택한 DB의 최신 스키마를 기준으로 SQL을 생성합니다.</p></div> : messages.map((message) => <article key={message.id} className={`message message--${message.role}`}><span>{message.role === "user" ? "질문" : message.status === "pending" ? "답변 생성 중" : "답변"}</span><p>{message.content}</p>{message.referencedTables && message.referencedTables.length > 0 && <small>참조: {message.referencedTables.join(", ")}</small>}{message.assumptions?.map((item) => <small key={`a-${item}`}>가정: {item}</small>)}{message.warnings?.map((item) => <small className="message-warning" key={`w-${item}`}>주의: {item}</small>)}{message.sqlApplied && <small>SQL 편집기에 반영됨</small>}</article>)}
    </div>
    {notice && <p className="workspace-notice" role="status">{notice}</p>}
    <div className="question-compose">
      <label htmlFor="analysis-question">업무 조회 요청</label>
      <textarea id="analysis-question" value={question} onChange={(event) => onQuestionChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); onSubmit(); } }} placeholder="예: 지난달 거래처별 주문 금액을 보고 싶습니다." disabled={disabled || submitting} aria-describedby={error ? "analysis-error" : undefined} />
      {error && <p id="analysis-error" className="compose-error" role="alert">{error}</p>}
      <div><small>Enter 줄바꿈 · Ctrl+Enter 전송</small><button type="button" onClick={onSubmit} disabled={disabled || submitting || question.trim().length < 2}>{submitting ? "생성 중…" : "질문 전송"}</button></div>
    </div>
  </section>;
}
