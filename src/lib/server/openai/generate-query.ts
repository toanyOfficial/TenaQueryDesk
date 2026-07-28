import "server-only";
import type { SchemaBundle } from "@/lib/server/schema/types";
import { selectSchema } from "@/lib/server/schema/select-schema";
import { requestStructuredCompletion } from "./client";
import { buildQueryUserPrompt, QUERY_SYSTEM_PROMPT } from "./prompts";
import { parseGeneratedQueryResponse } from "./response-schema";
import type { QueryGenerationRecord } from "./types";
import { OpenAiOperationError } from "./errors";
export async function generateQueryFromSchema(connectionId: number, prompt: string, bundle: SchemaBundle): Promise<QueryGenerationRecord> {
  const normalized = prompt.trim();
  if (!Number.isSafeInteger(connectionId) || connectionId < 1 || bundle.manifest.connectionId !== connectionId) throw new Error("잘못된 대상 DB입니다.");
  if (normalized.length < 2 || normalized.length > 5_000) throw new Error("질문은 2자 이상 5,000자 이하로 입력해 주세요.");
  const started = Date.now(); const startedAt = new Date(started).toISOString();
  const selection = selectSchema(normalized, bundle);
  const completion = await requestStructuredCompletion(QUERY_SYSTEM_PROMPT, buildQueryUserPrompt(normalized, selection));
  let result; try { result = parseGeneratedQueryResponse(completion.value, new Set(selection.selectedTables)); } catch { throw new OpenAiOperationError("response_invalid"); }
  const completed = Date.now();
  return { connectionId, prompt: normalized, model: completion.model, result, startedAt, completedAt: new Date(completed).toISOString(), durationMs: completed - started };
}
