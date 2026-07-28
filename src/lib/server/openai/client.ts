import "server-only";
import { getOpenAIEnvironment } from "@/lib/server/env";
import { GENERATED_QUERY_JSON_SCHEMA } from "./response-schema";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export async function requestStructuredCompletion(system: string, user: string): Promise<{ model: string; value: unknown }> {
  const { apiKey, model } = getOpenAIEnvironment();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(OPENAI_ENDPOINT, { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_schema", json_schema: GENERATED_QUERY_JSON_SCHEMA }, temperature: 0 }) });
    if (!response.ok) throw new Error();
    const body = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error();
    return { model, value: JSON.parse(content) as unknown };
  } catch { throw new Error("GPT 응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  finally { clearTimeout(timer); }
}
