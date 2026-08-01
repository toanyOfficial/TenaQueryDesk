import type { BusinessKnowledgeEntry, KnowledgeType } from "./business-knowledge-types";

export function rankBusinessKnowledge(candidates: readonly BusinessKnowledgeEntry[], query: string, types: readonly KnowledgeType[] | undefined, limit: number) {
  const words = normalize(query).split(" ").filter((word) => word.length > 1);
  return candidates.filter((entry) => !types?.length || types.includes(entry.type)).map((entry) => score(entry, words)).filter((match) => match.score > match.entry.priority / 100).sort((left, right) => right.score - left.score || right.entry.priority - left.entry.priority).slice(0, limit);
}
function score(entry: BusinessKnowledgeEntry, words: string[]) { const fields = { title: normalize(entry.title), key: normalize(entry.key), aliases: normalize(entry.aliases.join(" ")), description: normalize(entry.description), targets: normalize(entry.targets.map((target) => `${target.tableName} ${target.columnName ?? ""} ${target.targetValue ?? ""}`).join(" ")) }; let value = entry.priority / 100; const reasons: string[] = []; for (const word of words) for (const [field, text] of Object.entries(fields)) if (text.includes(word)) { value += field === "title" ? 8 : field === "aliases" ? 6 : field === "key" ? 5 : 2; reasons.push(`${field}:${word}`); } return { entry, score: Math.round(value * 100) / 100, reasons: [...new Set(reasons)] }; }
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣_$.-]+/g, " ").trim();
