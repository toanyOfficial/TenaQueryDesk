import type { AnalysisHistoryItem } from "./types";

type Props = Readonly<{
  open: boolean;
  status: "idle" | "loading" | "success" | "empty" | "error";
  items: ReadonlyArray<AnalysisHistoryItem>;
  detailLoadingId: string | null;
  onClose: () => void;
  onReload: () => void;
  onSelect: (id: string) => void;
}>;

export function HistoryDrawer({ open, status, items, detailLoadingId, onClose, onReload, onSelect }: Props) {
  if (!open) return null;
  return <aside className="history-drawer" aria-label="최근 GPT 질의 이력">
    <header><div><span>HISTORY</span><h3>최근 질문</h3></div><button type="button" className="text-button" onClick={onClose}>닫기</button></header>
    <div className="history-body">
      {status === "loading" && <p className="history-state">최근 이력을 불러오는 중…</p>}
      {status === "empty" && <p className="history-state">저장된 질의 이력이 없습니다.</p>}
      {status === "error" && <div className="history-state"><p>질의 이력을 불러오지 못했습니다.</p><button type="button" onClick={onReload}>다시 시도</button></div>}
      {status === "success" && items.map((item) => <button className="history-item" type="button" key={item.id} onClick={() => onSelect(item.id)} disabled={detailLoadingId === item.id}><span><b>{item.status === "success" ? "진행 중" : "보관됨"}</b>{item.hasSql ? " · SQL" : ""}{item.executed ? " · 실행됨" : ""}</span><strong>{item.title}</strong><small>{item.messageCount}개 메시지 · {new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</small></button>)}
    </div>
  </aside>;
}
