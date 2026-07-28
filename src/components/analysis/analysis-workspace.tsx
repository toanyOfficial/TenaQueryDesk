"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { AssistantPanel } from "./assistant-panel";
import { DatabaseSelector } from "./database-selector";
import { HistoryDrawer } from "./history-drawer";
import { QueryResultPanel } from "./query-result-panel";
import { SchemaStatus } from "./schema-status";
import { SqlEditorPanel } from "./sql-editor-panel";
import type { AnalysisHistoryDetail, AnalysisHistoryItem, AnalysisMessage, DatabaseOption, GeneratedQueryResponse, QueryResult, QueryStatus, SchemaSummary } from "./types";

type State = { connectionId: number | null; analysisHistoryId: number | null; messages: AnalysisMessage[]; question: string; sql: string; queryStatus: QueryStatus; queryResult: QueryResult | null; error: string | null; notice: string | null };
type Action = { type: "select"; id: number } | { type: "question"; value: string } | { type: "sql"; value: string } | { type: "clearMessages" } | { type: "clearSql" } | { type: "messages"; value: AnalysisMessage[] } | { type: "analysisError"; value: string | null } | { type: "historySource"; id: number | null } | { type: "restore"; detail: AnalysisHistoryDetail };
const initialState: State = { connectionId: null, analysisHistoryId: null, messages: [], question: "", sql: "", queryStatus: "idle", queryResult: null, error: null, notice: null };
function reducer(state: State, action: Action): State {
  if (action.type === "select") return { ...initialState, connectionId: action.id, notice: state.connectionId === null ? null : "대상 DB가 변경되어 질문, SQL 및 실행 결과를 초기화했습니다." };
  if (action.type === "question") return { ...state, question: action.value };
  if (action.type === "sql") return { ...state, sql: action.value };
  if (action.type === "clearMessages") return { ...state, messages: [], question: "" };
  if (action.type === "messages") return { ...state, messages: action.value };
  if (action.type === "analysisError") return { ...state, error: action.value };
  if (action.type === "historySource") return { ...state, analysisHistoryId: action.id };
  if (action.type === "restore") return { ...state, analysisHistoryId: action.detail.id, messages: [{ id: `history-user-${action.detail.id}`, role: "user", content: action.detail.userPrompt, status: "success" }, { id: `history-assistant-${action.detail.id}`, role: "assistant", content: action.detail.status === "success" ? action.detail.assistantAnswer ?? "설명이 저장되지 않았습니다." : action.detail.errorMessage ?? "질의 생성에 실패했습니다.", status: action.detail.status }], sql: action.detail.status === "success" && action.detail.generatedSql ? action.detail.generatedSql : state.sql, error: null, notice: `이력 #${action.detail.id}을 불러왔습니다.` };
  return { ...state, sql: "", analysisHistoryId: null, queryStatus: "idle", queryResult: null, error: null };
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
  const [submitting, setSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);

  useEffect(() => { void (async () => { try { const response = await fetch("/api/db-connections", { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const options = safeDatabases(await response.json()); setDatabases(options); if (options.length > 0) dispatch({ type: "select", id: options[0].id }); } catch { setDatabaseError("대상 DB 목록을 불러오지 못했습니다. 관리 기능 구성을 확인하세요."); } finally { setDatabaseLoading(false); } })(); }, [router]);
  useEffect(() => { setSchema(null); setSchemaError(null); if (state.connectionId === null) return; const controller = new AbortController(); setSchemaLoading(true); void (async () => { try { const response = await fetch(`/api/db-connections/${state.connectionId}/schema/snapshots?limit=1`, { cache: "no-store", signal: controller.signal }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { latest?: unknown }; setSchema(safeSchemaSummary(body.latest) ?? { versionNo: 0, status: "missing", tableCount: null, generatedAt: null, schemaHash: null }); } catch (error) { if ((error as Error).name !== "AbortError") setSchemaError("최신 스키마 상태를 불러오지 못했습니다."); } finally { if (!controller.signal.aborted) setSchemaLoading(false); } })(); return () => controller.abort(); }, [router, state.connectionId]);
  const selected = databases.find((database) => database.id === state.connectionId) ?? null;
  const assistantDisabled = !selected || schema?.status !== "success";
  async function submitQuestion() {
    const prompt = state.question.trim();
    if (submitting || assistantDisabled || state.connectionId === null || prompt.length < 2) return;
    if (state.sql.trim() && !window.confirm("새 GPT 결과가 현재 SQL을 교체할 수 있습니다. 계속하시겠습니까?")) return;
    const user: AnalysisMessage = { id: crypto.randomUUID(), role: "user", content: prompt, status: "success" };
    const pending: AnalysisMessage = { id: crypto.randomUUID(), role: "assistant", content: "선택한 스키마에서 관련 테이블을 찾고 있습니다…", status: "pending" };
    const nextMessages = [...state.messages, user, pending]; dispatch({ type: "messages", value: nextMessages }); dispatch({ type: "analysisError", value: null }); setSubmitting(true);
    try {
      const response = await fetch("/api/analysis/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: state.connectionId, prompt }) });
      if (response.status === 401) { router.replace("/login"); return; }
      const body = await response.json() as { ok?: boolean; analysisHistoryId?: number | null; historyWarning?: string; result?: GeneratedQueryResponse; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error || "GPT 응답을 생성하지 못했습니다.");
      const result = body.result; const sqlApplied = Boolean(result.sql);
      dispatch({ type: "messages", value: [...nextMessages.slice(0, -1), { id: pending.id, role: "assistant", content: result.answer, status: "success", referencedTables: result.referencedTables, assumptions: result.assumptions, warnings: result.warnings, sqlApplied }] });
      dispatch({ type: "question", value: "" }); if (result.sql) dispatch({ type: "sql", value: result.sql });
      dispatch({ type: "historySource", id: Number.isSafeInteger(body.analysisHistoryId) ? body.analysisHistoryId as number : null });
    } catch (error) { const message = error instanceof Error ? error.message : "GPT 응답을 생성하지 못했습니다."; dispatch({ type: "messages", value: [...nextMessages.slice(0, -1), { ...pending, content: message, status: "failed" }] }); dispatch({ type: "analysisError", value: message }); }
    finally { setSubmitting(false); }
  }
  async function loadHistory() {
    if (state.connectionId === null) return; setHistoryStatus("loading");
    try { const response = await fetch(`/api/analysis/history?connectionId=${state.connectionId}&limit=20`, { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { items?: AnalysisHistoryItem[] }; const items = Array.isArray(body.items) ? body.items : []; setHistoryItems(items); setHistoryStatus(items.length ? "success" : "empty"); } catch { setHistoryStatus("error"); }
  }
  async function openHistory() { setHistoryOpen(true); await loadHistory(); }
  async function restoreHistory(id: number) {
    if (state.connectionId === null || !Number.isSafeInteger(id)) return;
    if (state.sql.trim() && !window.confirm("과거 이력의 SQL이 현재 SQL을 교체할 수 있습니다. 계속하시겠습니까?")) return;
    setDetailLoadingId(id);
    try { const response = await fetch(`/api/analysis/history/${id}`, { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { item?: AnalysisHistoryDetail }; if (!body.item || body.item.connectionId !== state.connectionId) throw new Error(); dispatch({ type: "restore", detail: body.item }); setHistoryOpen(false); } catch { setHistoryStatus("error"); } finally { setDetailLoadingId(null); }
  }
  return <main className="analysis-shell">
    <header className="analysis-topbar"><div className="analysis-brand"><span>TQ</span><div><small>TENA INTERNAL TOOLS</small><strong>Tena Query Desk</strong></div><b>분석</b></div><div className="topbar-tools"><DatabaseSelector databases={databases} connectionId={state.connectionId} loading={databaseLoading} error={databaseError} onChange={(id) => dispatch({ type: "select", id })} /><SchemaStatus status={schema} loading={schemaLoading} error={schemaError} hasDatabase={Boolean(selected)} /><button className="nav-button" type="button" disabled title="대상 DB 관리 화면은 선행 단계 구현 후 연결됩니다.">관리</button><LogoutButton /></div></header>
    {databaseError && <div className="global-alert" role="alert">{databaseError}</div>}
    {!databaseLoading && !databaseError && databases.length === 0 && <div className="global-alert global-alert--info">등록된 활성 DB가 없습니다. 관리 화면에서 DB 연결을 등록하세요.</div>}
    <div className="analysis-grid"><AssistantPanel database={selected} messages={state.messages} question={state.question} disabled={assistantDisabled} submitting={submitting} error={state.error} notice={state.notice ?? (selected && schema?.status !== "success" ? "최신 스키마가 없습니다. 관리 화면에서 스키마를 생성한 뒤 질문할 수 있습니다." : null)} onQuestionChange={(value) => dispatch({ type: "question", value })} onClear={() => dispatch({ type: "clearMessages" })} onSubmit={submitQuestion} onOpenHistory={openHistory} /><div className="analysis-right"><SqlEditorPanel database={selected} sql={state.sql} onChange={(value) => dispatch({ type: "sql", value })} onClear={() => dispatch({ type: "clearSql" })} /><QueryResultPanel status={state.queryStatus} result={state.queryResult} error={null} /></div><HistoryDrawer open={historyOpen} status={historyStatus} items={historyItems} detailLoadingId={detailLoadingId} onClose={() => setHistoryOpen(false)} onReload={loadHistory} onSelect={restoreHistory} /></div>
  </main>;
}
