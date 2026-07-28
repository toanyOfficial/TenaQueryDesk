import type { AnalysisMessage, DatabaseOption } from "./types";

type Props = Readonly<{ database: DatabaseOption | null; messages: ReadonlyArray<AnalysisMessage>; question: string; disabled: boolean; notice: string | null; onQuestionChange: (value: string) => void; onClear: () => void }>;

export function AssistantPanel({ database, messages, question, disabled, notice, onQuestionChange, onClear }: Props) {
  return <section className="analysis-panel assistant-panel" aria-labelledby="assistant-heading">
    <header className="panel-bar"><div><span>ASK</span><h2 id="assistant-heading">GPT 질문 및 답변</h2></div><button type="button" className="text-button" onClick={onClear} disabled={messages.length === 0}>대화 초기화</button></header>
    <div className="panel-context">{database ? `${database.displayName} 스키마 기준` : "대상 DB를 먼저 선택하세요"}</div>
    <div className="message-list" aria-live="polite">
      {messages.length === 0 ? <div className="panel-empty"><strong>조회하려는 내용을 입력하세요.</strong><p>선택한 DB의 최신 스키마를 기준으로 SQL을 생성합니다.</p></div> : messages.map((message) => <article key={message.id} className={`message message--${message.role}`}><span>{message.role === "user" ? "질문" : "답변"}</span><p>{message.content}</p></article>)}
    </div>
    {notice && <p className="workspace-notice" role="status">{notice}</p>}
    <div className="question-compose">
      <label htmlFor="analysis-question">업무 조회 요청</label>
      <textarea id="analysis-question" value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder="예: 지난달 거래처별 주문 금액을 보고 싶습니다." disabled={disabled} />
      <div><small>Enter 줄바꿈 · 질문 전송은 Step 8에서 연결됩니다.</small><button type="button" disabled>질문 전송</button></div>
    </div>
  </section>;
}
