const MAX_CELL_CHARACTERS = 100_000;
export type SerializedValue = null | boolean | number | string | ReadonlyArray<unknown> | Readonly<Record<string, unknown>>;
export function serializeCell(value: unknown): { value: SerializedValue; truncated: boolean } {
  if (value === null) return { value: null, truncated: false };
  if (typeof value === "bigint") return { value: value.toString(), truncated: false };
  if (typeof value === "string") return value.length > MAX_CELL_CHARACTERS ? { value: `${value.slice(0, MAX_CELL_CHARACTERS)}…`, truncated: true } : { value, truncated: false };
  if (typeof value === "number" || typeof value === "boolean") return { value, truncated: false };
  if (value instanceof Date) return { value: value.toISOString(), truncated: false };
  if (Buffer.isBuffer(value)) return { value: `[binary ${value.byteLength} bytes]`, truncated: value.byteLength > 0 };
  try { const text = JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child); if (text.length > MAX_CELL_CHARACTERS) return { value: `${text.slice(0, MAX_CELL_CHARACTERS)}…`, truncated: true }; return { value: JSON.parse(text) as SerializedValue, truncated: false }; } catch { throw new Error("쿼리 결과를 직렬화하지 못했습니다."); }
}
export function serializeRows(rows: ReadonlyArray<Record<string, unknown>>) { let truncatedCells = 0; const serialized = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => { const cell=serializeCell(value); if(cell.truncated) truncatedCells++; return [key, cell.value]; }))); return { rows: serialized, truncatedCells }; }
