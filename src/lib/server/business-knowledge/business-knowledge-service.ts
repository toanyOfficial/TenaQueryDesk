import { getTargetConnection } from "@/lib/server/db/target-connections";
import { createKnowledge, findConflicts, getKnowledge, listAudit, listKnowledge, saveValidation, updateKnowledge } from "./business-knowledge-repository";
import { validateKnowledgeInput } from "./business-knowledge-policy";
import { searchBusinessKnowledge } from "./business-knowledge-search";
import { BusinessKnowledgeError, type BusinessKnowledgeInput, type KnowledgeStatus, type KnowledgeType } from "./business-knowledge-types";
import { validateAgainstSchema } from "./business-knowledge-validator";

export async function createBusinessKnowledge(value: unknown, actor: string) {
  const input = validateKnowledgeInput(value);
  const validation = await validate(input);
  await assertActivatable(input, validation);
  const conflicts = input.status === "active" ? await findConflicts(input) : [];
  if (conflicts.length) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_CONFLICT", "같은 범위와 기간에 충돌하는 active 정의가 있습니다.");
  const created = await createKnowledge(input, actor);
  await saveValidation(created.id, validation, false);
  return getKnowledge(created.id, input.connectionId, false);
}

export async function updateBusinessKnowledge(id: string, value: unknown, expectedVersion: number, actor: string) {
  const input = validateKnowledgeInput(value);
  const validation = await validate(input);
  await assertActivatable(input, validation);
  const conflicts = input.status === "active" ? await findConflicts(input, id) : [];
  if (conflicts.length) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_CONFLICT", "같은 범위와 기간에 충돌하는 active 정의가 있습니다.");
  const updated = await updateKnowledge(id, input, expectedVersion, actor);
  await saveValidation(id, validation, false);
  return getKnowledge(updated.id, input.connectionId, false);
}

export async function validateStoredKnowledge(id: string, connectionId: number | null, invalidate = true) {
  const entry = await getKnowledge(id, connectionId, false);
  const validation = await validate(entry);
  await saveValidation(id, validation, invalidate);
  return validation;
}

export async function listBusinessKnowledge(input: { connectionId: number; query?: string; type?: KnowledgeType; status?: KnowledgeStatus; limit?: number }) {
  return listKnowledge({ ...input, limit: input.limit ?? 50 });
}
export async function readBusinessKnowledge(id: string, connectionId: number) { return getKnowledge(id, connectionId, true); }
export async function searchActiveBusinessKnowledge(connectionId: number, query: string, types?: readonly KnowledgeType[], limit = 10) { return searchBusinessKnowledge(connectionId, query, types, Math.min(Math.max(limit, 1), 20)); }
export async function getKnowledgeAudit(id: string) { return listAudit(id); }

export async function getColumnSemantics(connectionId: number, tableName: string, columnName: string) {
  const entries = (await listKnowledge({ connectionId, query: `${tableName} ${columnName}`, limit: 100, activeOnly: true })).filter((entry) => entry.targets.some((target) => target.tableName.toLowerCase() === tableName.toLowerCase() && target.columnName?.toLowerCase() === columnName.toLowerCase()));
  return { found: entries.length > 0, tableName, columnName, definitions: entries, sensitivity: strictest(entries.flatMap((entry) => entry.targets.map((target) => target.sensitivity).filter(Boolean) as string[])) };
}
export async function getMetricDefinition(connectionId: number, metric: string) {
  const matches = (await listKnowledge({ connectionId, query: metric, type: "metric", limit: 20, activeOnly: true })).filter((entry) => [entry.title, entry.key, ...entry.aliases].some((value) => value.toLowerCase() === metric.toLowerCase()));
  return matches.length === 1 ? { found: true, conflict: false, definition: matches[0] } : { found: matches.length > 0, conflict: matches.length > 1, definitions: matches };
}
export async function getBusinessRelationship(connectionId: number, sourceTable: string, targetConcept: string) {
  const entries = await listKnowledge({ connectionId, query: `${sourceTable} ${targetConcept}`, type: "relationship", limit: 20, activeOnly: true });
  return { found: entries.length > 0, relationships: entries.filter((entry) => entry.targets.some((target) => target.tableName.toLowerCase() === sourceTable.toLowerCase())) };
}
export async function getSensitivityPolicies(connectionId: number, columns: readonly string[]) {
  const policies = new Map<string, string>();
  await Promise.all(columns.map(async (column) => { const entries = await listKnowledge({ connectionId, query: column, type: "sensitivity", limit: 20, activeOnly: true }); const levels = entries.flatMap((entry) => entry.targets.filter((target) => target.columnName?.toLowerCase() === column.toLowerCase()).map((target) => target.sensitivity).filter(Boolean) as string[]); const level = strictest(levels); if (level) policies.set(column.toLowerCase(), level); }));
  return policies;
}

async function validate(input: BusinessKnowledgeInput) { const connection = input.connectionId ? await getTargetConnection(input.connectionId) : null; return validateAgainstSchema(input, connection); }
async function assertActivatable(input: BusinessKnowledgeInput, validation: { valid: boolean }) { if (input.status === "active" && !validation.valid) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_VALIDATION_FAILED", "스키마 검증에 실패한 정의는 활성화할 수 없습니다."); }
function strictest(levels: string[]) { return levels.sort((a, b) => ["public", "internal", "personal", "restricted", "secret"].indexOf(b) - ["public", "internal", "personal", "restricted", "secret"].indexOf(a))[0] ?? null; }
