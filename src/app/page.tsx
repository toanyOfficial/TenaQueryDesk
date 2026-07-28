const panels = {
  assistant: {
    eyebrow: "ASK",
    title: "GPT 질문 및 답변",
    description: "자연어 질문과 스키마 기반 분석 과정이 이곳에 표시됩니다.",
  },
  editor: {
    eyebrow: "WRITE",
    title: "SQL 편집기",
    description: "생성된 SQL을 검토하고 수정하는 작업 공간입니다.",
  },
  results: {
    eyebrow: "REVIEW",
    title: "SQL 실행 결과",
    description: "안전성 검증을 통과한 조회 결과가 표 형태로 표시됩니다.",
  },
};

function EmptyPanel({
  eyebrow,
  title,
  description,
}: (typeof panels)[keyof typeof panels]) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="empty-state">
        <span className="empty-state-mark" aria-hidden="true" />
        <p>{description}</p>
        <span>후속 개발 단계에서 연결됩니다.</span>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">TQ</span>
          <div>
            <p>TENA INTERNAL TOOLS</p>
            <h1>Tena Query Desk</h1>
          </div>
        </div>
        <p className="product-summary">
          실제 DB 스키마를 기준으로 안전한 조회 SQL을 준비하는 내부 분석 공간
        </p>
        <div className="status" aria-label="현재 서비스 상태">
          <span aria-hidden="true" />
          기반 구성 중
        </div>
      </header>

      <div className="workspace-grid">
        <EmptyPanel {...panels.assistant} />

        <div className="right-column">
          <div className="toolbar" aria-label="조회 도구 영역">
            <div>
              <span className="toolbar-label">TARGET DATABASE</span>
              <strong>연결 정보 준비 예정</strong>
            </div>
            <button type="button" disabled>
              쿼리 실행
            </button>
          </div>
          <EmptyPanel {...panels.editor} />
          <EmptyPanel {...panels.results} />
        </div>
      </div>
    </main>
  );
}
