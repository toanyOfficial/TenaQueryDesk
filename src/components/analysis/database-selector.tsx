import type { DatabaseOption } from "./types";

type Props = Readonly<{
  databases: ReadonlyArray<DatabaseOption>;
  connectionId: number | null;
  loading: boolean;
  error: string | null;
  onChange: (connectionId: number) => void;
}>;

export function DatabaseSelector({ databases, connectionId, loading, error, onChange }: Props) {
  const label = loading ? "목록 불러오는 중" : error ? "목록 조회 실패" : databases.length === 0 ? "활성 DB 없음" : "대상 DB 선택";
  return (
    <div className="database-control">
      <label htmlFor="database-select">TARGET DATABASE</label>
      <select id="database-select" value={connectionId ?? ""} onChange={(event) => onChange(Number(event.target.value))} disabled={loading || databases.length === 0} aria-describedby={error ? "database-error" : undefined}>
        <option value="">{label}</option>
        {databases.map((database) => <option key={database.id} value={database.id}>{database.displayName}</option>)}
      </select>
      {error && <span id="database-error" className="sr-only">{error}</span>}
    </div>
  );
}
