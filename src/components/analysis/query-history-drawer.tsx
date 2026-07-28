import type { QueryHistoryItem } from "./types";

type Props = Readonly<{
  open: boolean;
  status: "idle" | "loading" | "success" | "empty" | "error";
  items: ReadonlyArray<QueryHistoryItem>;
  detailLoadingId: number | null;
  onClose: () => void;
  onReload: () => void;
  onSelect: (id: number) => void;
}>;

export function QueryHistoryDrawer({ open, status, items, detailLoadingId, onClose, onReload, onSelect }: Props) {
  if (!open) return null;
  return <aside className="history-drawer query-history-drawer" aria-label="최근 SQL 실행 이력">
    <header><div><span>EXECUTIONS</span><h3>최근 실행</h3></div><button type="button" className="text-button" onClick={onClose}>닫기</button></header>
    <div className="history-body">
      {status === "loading" && <p className="history-state">실행 이력을 불러오는 중…</p>}
      {status === "empty" && <p className="history-state">저장된 실행 이력이 없습니다.</p>}
      {status === "error" && <div className="history-state"><p>실행 이력을 불러오지 못했습니다.</p><button type="button" onClick={onReload}>다시 시도</button></div>}
      {status === "success" && items.map((item) => <button type="button" className="history-item" key={item.id} onClick={() => onSelect(item.id)} disabled={detailLoadingId === item.id}><span><b>{item.success ? "성공" : "실패"}</b>{item.rowCount === null ? "행 수 없음" : `${item.rowCount}행`} · {item.executionMs === null ? "시간 없음" : `${item.executionMs}ms`}</span><strong>{item.sqlPreview}</strong><small>{item.analysisHistoryId ? "GPT 질의 이력 연결됨" : "직접 작성 또는 출처 없음"} · {new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</small>{item.errorMessage && <em>{item.errorMessage}</em>}</button>)}
    </div>
  </aside>;
}
