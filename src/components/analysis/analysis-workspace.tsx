"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { AssistantPanel } from "./assistant-panel";
import { DatabaseSelector } from "./database-selector";
import { QueryResultPanel } from "./query-result-panel";
import { SchemaStatus } from "./schema-status";
import { SqlEditorPanel } from "./sql-editor-panel";
import type { AnalysisMessage, DatabaseOption, QueryResult, QueryStatus, SchemaSummary } from "./types";

type State = { connectionId: number | null; messages: AnalysisMessage[]; question: string; sql: string; queryStatus: QueryStatus; queryResult: QueryResult | null; error: string | null; notice: string | null };
type Action = { type: "select"; id: number } | { type: "question"; value: string } | { type: "sql"; value: string } | { type: "clearMessages" } | { type: "clearSql" };
const initialState: State = { connectionId: null, messages: [], question: "", sql: "", queryStatus: "idle", queryResult: null, error: null, notice: null };
function reducer(state: State, action: Action): State {
  if (action.type === "select") return { ...initialState, connectionId: action.id, notice: state.connectionId === null ? null : "대상 DB가 변경되어 질문, SQL 및 실행 결과를 초기화했습니다." };
  if (action.type === "question") return { ...state, question: action.value };
  if (action.type === "sql") return { ...state, sql: action.value };
  if (action.type === "clearMessages") return { ...state, messages: [], question: "" };
  return { ...state, sql: "", queryStatus: "idle", queryResult: null, error: null };
}

function safeDatabases(value: unknown): DatabaseOption[] {
  if (!value || typeof value !== "object" || !("connections" in value) || !Array.isArray(value.connections)) return [];
  return value.connections.filter((item): item is DatabaseOption => Boolean(item) && typeof item === "object" && Number.isSafeInteger((item as DatabaseOption).id) && typeof (item as DatabaseOption).displayName === "string" && (item as DatabaseOption).dbType === "mysql");
}

function safeSchemaSummary(value: unknown): SchemaSummary | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<SchemaSummary>;
  if (!Number.isSafeInteger(item.versionNo) || !["processing", "success", "failed", "missing"].includes(item.status ?? "")) return null;
  return {
    versionNo: item.versionNo as number,
    status: item.status as SchemaSummary["status"],
    tableCount: Number.isSafeInteger(item.tableCount) ? item.tableCount as number : null,
    generatedAt: typeof item.generatedAt === "string" && !Number.isNaN(Date.parse(item.generatedAt)) ? item.generatedAt : null,
    schemaHash: typeof item.schemaHash === "string" && /^[0-9a-f]{64}$/.test(item.schemaHash) ? item.schemaHash : null,
  };
}

export function AnalysisWorkspace() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaSummary | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => { void (async () => { try { const response = await fetch("/api/db-connections", { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const options = safeDatabases(await response.json()); setDatabases(options); if (options.length > 0) dispatch({ type: "select", id: options[0].id }); } catch { setDatabaseError("대상 DB 목록을 불러오지 못했습니다. 관리 기능 구성을 확인하세요."); } finally { setDatabaseLoading(false); } })(); }, [router]);
  useEffect(() => { setSchema(null); setSchemaError(null); if (state.connectionId === null) return; const controller = new AbortController(); setSchemaLoading(true); void (async () => { try { const response = await fetch(`/api/db-connections/${state.connectionId}/schema/snapshots?limit=1`, { cache: "no-store", signal: controller.signal }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { latest?: unknown }; setSchema(safeSchemaSummary(body.latest) ?? { versionNo: 0, status: "missing", tableCount: null, generatedAt: null, schemaHash: null }); } catch (error) { if ((error as Error).name !== "AbortError") setSchemaError("최신 스키마 상태를 불러오지 못했습니다."); } finally { if (!controller.signal.aborted) setSchemaLoading(false); } })(); return () => controller.abort(); }, [router, state.connectionId]);
  const selected = databases.find((database) => database.id === state.connectionId) ?? null;
  const assistantDisabled = !selected || schema?.status !== "success";
  return <main className="analysis-shell">
    <header className="analysis-topbar"><div className="analysis-brand"><span>TQ</span><div><small>TENA INTERNAL TOOLS</small><strong>Tena Query Desk</strong></div><b>분석</b></div><div className="topbar-tools"><DatabaseSelector databases={databases} connectionId={state.connectionId} loading={databaseLoading} error={databaseError} onChange={(id) => dispatch({ type: "select", id })} /><SchemaStatus status={schema} loading={schemaLoading} error={schemaError} hasDatabase={Boolean(selected)} /><button className="nav-button" type="button" disabled title="대상 DB 관리 화면은 선행 단계 구현 후 연결됩니다.">관리</button><LogoutButton /></div></header>
    {databaseError && <div className="global-alert" role="alert">{databaseError}</div>}
    {!databaseLoading && !databaseError && databases.length === 0 && <div className="global-alert global-alert--info">등록된 활성 DB가 없습니다. 관리 화면에서 DB 연결을 등록하세요.</div>}
    <div className="analysis-grid"><AssistantPanel database={selected} messages={state.messages} question={state.question} disabled={assistantDisabled} notice={state.notice ?? (selected && schema?.status !== "success" ? "최신 스키마가 없습니다. 관리 화면에서 스키마를 생성한 뒤 질문할 수 있습니다." : null)} onQuestionChange={(value) => dispatch({ type: "question", value })} onClear={() => dispatch({ type: "clearMessages" })} /><div className="analysis-right"><SqlEditorPanel database={selected} sql={state.sql} onChange={(value) => dispatch({ type: "sql", value })} onClear={() => dispatch({ type: "clearSql" })} /><QueryResultPanel status={state.queryStatus} result={state.queryResult} error={state.error} /></div></div>
  </main>;
}
