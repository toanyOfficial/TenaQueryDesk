import type { SchemaSummary } from "./types";

type Props = Readonly<{ status: SchemaSummary | null; loading: boolean; error: string | null; hasDatabase: boolean }>;

export function SchemaStatus({ status, loading, error, hasDatabase }: Props) {
  let tone = "neutral";
  let text = "DB를 선택하세요";
  if (loading) text = "스키마 상태 확인 중…";
  else if (error) { tone = "danger"; text = "스키마 상태 조회 실패"; }
  else if (hasDatabase && (!status || status.status === "missing")) { tone = "warning"; text = "최신 스키마 없음"; }
  else if (status?.status === "processing") { tone = "warning"; text = `Schema v${status.versionNo} · 생성 중`; }
  else if (status?.status === "failed") { tone = "danger"; text = `Schema v${status.versionNo} · 최근 생성 실패`; }
  else if (status?.status === "success") {
    const date = status.generatedAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(status.generatedAt)) : "시각 없음";
    text = `Schema v${status.versionNo} · ${status.tableCount ?? "-"} tables · ${date}`;
    tone = "success";
  }
  return <div className={`schema-chip schema-chip--${tone}`} title={status?.schemaHash ? `hash ${status.schemaHash.slice(0, 12)}` : undefined}><span aria-hidden="true" />{text}</div>;
}
