"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { AssistantPanel } from "./assistant-panel";
import { DatabaseSelector } from "./database-selector";
import { HistoryDrawer } from "./history-drawer";
import { QueryResultPanel } from "./query-result-panel";
import { QueryHistoryDrawer } from "./query-history-drawer";
import { SchemaStatus } from "./schema-status";
import { SqlEditorPanel } from "./sql-editor-panel";
import type { AnalysisHistoryDetail, AnalysisHistoryItem, AnalysisMessage, DatabaseOption, GeneratedQueryResponse, QueryHistoryDetail, QueryHistoryItem, QueryResult, QueryStatus, SchemaSummary } from "./types";

type State = { connectionId: number | null; analysisHistoryId: number | null; queryExecutionLogId: number | null; messages: AnalysisMessage[]; question: string; sql: string; queryStatus: QueryStatus; queryResult: QueryResult | null; error: string | null; notice: string | null };
type Action = { type: "select"; id: number } | { type: "question"; value: string } | { type: "sql"; value: string } | { type: "clearMessages" } | { type: "clearSql" } | { type: "messages"; value: AnalysisMessage[] } | { type: "analysisError"; value: string | null } | { type: "historySource"; id: number | null } | { type: "restore"; detail: AnalysisHistoryDetail } | { type: "queryRunning" } | { type: "querySuccess"; result: QueryResult } | { type: "queryEmpty"; result: QueryResult } | { type: "queryError"; message: string } | { type: "restoreQuery"; detail: QueryHistoryDetail };
const initialState: State = { connectionId: null, analysisHistoryId: null, queryExecutionLogId: null, messages: [], question: "", sql: "", queryStatus: "idle", queryResult: null, error: null, notice: null };
function reducer(state: State, action: Action): State {
  if (action.type === "select") return { ...initialState, connectionId: action.id, notice: state.connectionId === null ? null : "대상 DB가 변경되어 질문, SQL 및 실행 결과를 초기화했습니다." };
  if (action.type === "question") return { ...state, question: action.value };
  if (action.type === "sql") return { ...state, sql: action.value };
  if (action.type === "clearMessages") return { ...state, messages: [], question: "" };
  if (action.type === "messages") return { ...state, messages: action.value };
  if (action.type === "analysisError") return { ...state, error: action.value };
  if (action.type === "historySource") return { ...state, analysisHistoryId: action.id };
  if (action.type === "restore") return { ...state, analysisHistoryId: action.detail.id, messages: [{ id: `history-user-${action.detail.id}`, role: "user", content: action.detail.userPrompt, status: "success" }, { id: `history-assistant-${action.detail.id}`, role: "assistant", content: action.detail.status === "success" ? action.detail.assistantAnswer ?? "설명이 저장되지 않았습니다." : action.detail.errorMessage ?? "질의 생성에 실패했습니다.", status: action.detail.status, requestType: action.detail.requestType === "ddl_dml_reference" ? "ddl_dml_reference" : undefined, riskLevel: action.detail.requestType === "ddl_dml_reference" ? (/\b(?:DROP|TRUNCATE)\b/i.test(action.detail.generatedSql ?? "") ? "destructive" : /\b(?:CREATE|ALTER|RENAME)\b/i.test(action.detail.generatedSql ?? "") ? "schema_change" : "data_change") : undefined, warnings: action.detail.requestType === "ddl_dml_reference" ? ["과거 참고용 변경 SQL입니다. 사이트에서 실행할 수 없습니다."] : undefined }], sql: action.detail.status === "success" && action.detail.generatedSql ? action.detail.generatedSql : state.sql, error: null, notice: `이력 #${action.detail.id}을 불러왔습니다.` };
  if (action.type === "queryRunning") return { ...state, queryStatus: "running", queryResult: null, queryExecutionLogId: null, error: null };
  if (action.type === "querySuccess") return { ...state, queryStatus: "success", queryResult: action.result, queryExecutionLogId: action.result.queryExecutionLogId, error: null };
  if (action.type === "queryEmpty") return { ...state, queryStatus: "empty", queryResult: action.result, queryExecutionLogId: action.result.queryExecutionLogId, error: null };
  if (action.type === "queryError") return { ...state, queryStatus: "error", queryResult: null, error: action.message };
  if (action.type === "restoreQuery") return { ...state, sql: action.detail.sqlText, analysisHistoryId: action.detail.analysisHistoryId, queryExecutionLogId: action.detail.id, queryStatus: "idle", queryResult: null, error: null, notice: `실행 이력 #${action.detail.id}의 SQL을 불러왔습니다. 결과 행은 저장되지 않으며 자동 재실행하지 않습니다.` };
  return { ...state, sql: "", analysisHistoryId: null, queryExecutionLogId: null, queryStatus: "idle", queryResult: null, error: null };
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [queryHistoryOpen, setQueryHistoryOpen] = useState(false);
  const [queryHistoryStatus, setQueryHistoryStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [queryHistoryItems, setQueryHistoryItems] = useState<QueryHistoryItem[]>([]);
  const [queryDetailLoadingId, setQueryDetailLoadingId] = useState<number | null>(null);

  useEffect(() => { void (async () => { try { const response = await fetch("/api/db-connections", { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const options = safeDatabases(await response.json()); setDatabases(options); if (options.length > 0) dispatch({ type: "select", id: options[0].id }); } catch { setDatabaseError("대상 DB 목록을 불러오지 못했습니다. 관리 기능 구성을 확인하세요."); } finally { setDatabaseLoading(false); } })(); }, [router]);
  useEffect(() => { setSchema(null); setSchemaError(null); if (state.connectionId === null) return; const controller = new AbortController(); setSchemaLoading(true); void (async () => { try { const response = await fetch(`/api/db-connections/${state.connectionId}/schema/snapshots?limit=1`, { cache: "no-store", signal: controller.signal }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { latest?: unknown }; setSchema(safeSchemaSummary(body.latest) ?? { versionNo: 0, status: "missing", tableCount: null, generatedAt: null, schemaHash: null }); } catch (error) { if ((error as Error).name !== "AbortError") setSchemaError("최신 스키마 상태를 불러오지 못했습니다."); } finally { if (!controller.signal.aborted) setSchemaLoading(false); } })(); return () => controller.abort(); }, [router, state.connectionId]);
  const selected = databases.find((database) => database.id === state.connectionId) ?? null;
  const assistantDisabled = !selected;
  async function submitQuestion() {
    const prompt = state.question.trim();
    if (submitting || assistantDisabled || state.connectionId === null || prompt.length < 2) return;
    if (state.sql.trim() && !window.confirm("새 GPT 결과가 현재 SQL을 교체할 수 있습니다. 계속하시겠습니까?")) return;
    const user: AnalysisMessage = { id: crypto.randomUUID(), role: "user", content: prompt, status: "success" };
    const pending: AnalysisMessage = { id: crypto.randomUUID(), role: "assistant", content: "선택한 스키마에서 관련 테이블을 찾고 있습니다…", status: "pending" };
    const nextMessages = [...state.messages, user, pending]; dispatch({ type: "messages", value: nextMessages }); dispatch({ type: "analysisError", value: null }); setSubmitting(true);
    try {
      const response = await fetch("/api/analysis/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: state.connectionId, prompt, conversationId }) });
      if (response.status === 401) { router.replace("/login"); return; }
      const body = await response.json() as { ok?: boolean; analysisHistoryId?: number | null; historyWarning?: string; result?: GeneratedQueryResponse; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error || "GPT 응답을 생성하지 못했습니다.");
      const result = body.result; const sqlApplied = Boolean(result.sql);
      if (typeof (body as { conversationId?: unknown }).conversationId === "string") setConversationId((body as { conversationId: string }).conversationId);
      dispatch({ type: "messages", value: [...nextMessages.slice(0, -1), { id: pending.id, role: "assistant", content: result.answer, status: "success", referencedTables: result.referencedTables, assumptions: result.assumptions, warnings: result.warnings, sqlApplied, requestType: result.requestType, riskLevel: result.riskLevel, transactionGuidance: result.transactionGuidance, executionPlan: result.executionPlan }] });
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
  async function loadQueryHistory() {
    if (state.connectionId === null) return; setQueryHistoryStatus("loading");
    try { const response = await fetch(`/api/query/history?connectionId=${state.connectionId}&limit=20`, { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { items?: QueryHistoryItem[] }; const items = Array.isArray(body.items) ? body.items : []; setQueryHistoryItems(items); setQueryHistoryStatus(items.length ? "success" : "empty"); } catch { setQueryHistoryStatus("error"); }
  }
  async function openQueryHistory() { setQueryHistoryOpen(true); await loadQueryHistory(); }
  async function restoreQueryHistory(id: number) {
    if (state.connectionId === null || !Number.isSafeInteger(id)) return;
    if (state.sql.trim() && !window.confirm("과거 실행 SQL이 현재 SQL을 교체합니다. 계속하시겠습니까?")) return;
    setQueryDetailLoadingId(id);
    try { const response = await fetch(`/api/query/history/${id}`, { cache: "no-store" }); if (response.status === 401) { router.replace("/login"); return; } if (!response.ok) throw new Error(); const body = await response.json() as { item?: QueryHistoryDetail }; if (!body.item || body.item.connectionId !== state.connectionId) throw new Error(); dispatch({ type: "restoreQuery", detail: body.item }); setQueryHistoryOpen(false); } catch { setQueryHistoryStatus("error"); } finally { setQueryDetailLoadingId(null); }
  }
  async function executeQuery() {
    if (state.connectionId === null || !state.sql.trim() || state.queryStatus === "running") return;
    dispatch({ type: "queryRunning" });
    try { const response = await fetch("/api/query/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: state.connectionId, sql: state.sql, analysisHistoryId: state.analysisHistoryId }) }); if (response.status === 401) { router.replace("/login"); return; } const body = await response.json() as { ok?: boolean; queryExecutionLogId?: number | null; historyWarning?: string; result?: Omit<QueryResult, "queryExecutionLogId" | "analysisHistoryId" | "historyWarning" | "executedAt">; error?: string; errorType?: string }; if (!response.ok || !body.ok || !body.result) throw new Error(body.error || "쿼리 실행에 실패했습니다."); const result: QueryResult = { ...body.result, queryExecutionLogId: Number.isSafeInteger(body.queryExecutionLogId) ? body.queryExecutionLogId as number : null, analysisHistoryId: state.analysisHistoryId, historyWarning: typeof body.historyWarning === "string" ? body.historyWarning : null, executedAt: new Date().toISOString() }; dispatch({ type: result.rowCount === 0 ? "queryEmpty" : "querySuccess", result }); } catch (error) { dispatch({ type: "queryError", message: error instanceof Error ? error.message : "쿼리 실행에 실패했습니다." }); }
  }
  const latestGuidance = [...state.messages].reverse().find((message) => message.role === "assistant" && message.sqlApplied);
  return <main className="analysis-shell">
    <header className="analysis-topbar"><div className="analysis-brand"><span>TQ</span><div><small>TENA INTERNAL TOOLS</small><strong>Tena Query Desk</strong></div><b>분석</b></div><div className="topbar-tools"><DatabaseSelector databases={databases} connectionId={state.connectionId} loading={databaseLoading} error={databaseError} onChange={(id) => { setConversationId(null); dispatch({ type: "select", id }); }} /><SchemaStatus status={schema} loading={schemaLoading} error={schemaError} hasDatabase={Boolean(selected)} /><Link className="nav-button" href="/admin">관리</Link><LogoutButton /></div></header>
    {databaseError && <div className="global-alert" role="alert">{databaseError}</div>}
    {!databaseLoading && !databaseError && databases.length === 0 && <div className="global-alert global-alert--info">등록된 활성 DB가 없습니다. 관리 화면에서 DB 연결을 등록하세요.</div>}
    <div className="analysis-grid"><AssistantPanel database={selected} messages={state.messages} question={state.question} disabled={assistantDisabled} submitting={submitting} error={state.queryStatus === "error" ? null : state.error} notice={state.notice ?? (selected && schema?.status !== "success" ? "최신 스키마가 없습니다. Agent에게 현재 가능한 기능과 스키마 상태를 질문할 수 있습니다." : null)} onQuestionChange={(value) => dispatch({ type: "question", value })} onClear={() => dispatch({ type: "clearMessages" })} onSubmit={submitQuestion} onOpenHistory={openHistory} /><div className="analysis-right"><SqlEditorPanel database={selected} sql={state.sql} running={state.queryStatus === "running"} referenceType={latestGuidance?.requestType ?? null} riskLevel={latestGuidance?.riskLevel ?? null} onChange={(value) => dispatch({ type: "sql", value })} onClear={() => dispatch({ type: "clearSql" })} onExecute={executeQuery} /><QueryResultPanel status={state.queryStatus} result={state.queryResult} error={state.error} queryExecutionLogId={state.queryExecutionLogId} onOpenHistory={openQueryHistory} /></div><HistoryDrawer open={historyOpen} status={historyStatus} items={historyItems} detailLoadingId={detailLoadingId} onClose={() => setHistoryOpen(false)} onReload={loadHistory} onSelect={restoreHistory} /><QueryHistoryDrawer open={queryHistoryOpen} status={queryHistoryStatus} items={queryHistoryItems} detailLoadingId={queryDetailLoadingId} onClose={() => setQueryHistoryOpen(false)} onReload={loadQueryHistory} onSelect={restoreQueryHistory} /></div>
  </main>;
}
