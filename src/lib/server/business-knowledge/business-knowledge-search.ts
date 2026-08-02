import type { KnowledgeType } from "./business-knowledge-types";
import { listKnowledge } from "./business-knowledge-repository";
import { rankBusinessKnowledge } from "./business-knowledge-ranking";

export async function searchBusinessKnowledge(connectionId: number, query: string, types: readonly KnowledgeType[] | undefined, limit: number) {
  const candidates = await listKnowledge({ connectionId, limit: 100, activeOnly: true });
  return rankBusinessKnowledge(candidates, query, types, limit).map(({ entry, score, reasons }) => ({
    knowledgeId: entry.id, type: entry.type, title: entry.title, description: entry.description.slice(0, 500),
    scope: entry.connectionId === null ? "global" : "connection", relatedTables: [...new Set(entry.targets.map((target) => target.tableName))],
    relatedColumns: [...new Set(entry.targets.flatMap((target) => target.columnName ? [`${target.tableName}.${target.columnName}`] : []))],
    status: entry.status, version: entry.version, validatedSchemaVersion: entry.schemaVersion, score, matchReasons: reasons,
    warnings: entry.validationErrors,
  }));
}
