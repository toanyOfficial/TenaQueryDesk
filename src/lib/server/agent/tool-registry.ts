import type { AgentToolDefinition, OpenAiTool } from "./types";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();
  constructor(definitions: ReadonlyArray<AgentToolDefinition>) { for (const definition of definitions) this.register(definition); }
  register(definition: AgentToolDefinition): void { if (!/^[a-z][a-z0-9_]{0,63}$/.test(definition.name)) throw new Error("잘못된 도구 이름입니다."); if (this.tools.has(definition.name)) throw new Error(`중복된 도구 이름입니다: ${definition.name}`); this.tools.set(definition.name, definition); }
  get(name: string): AgentToolDefinition | null { return this.tools.get(name) ?? null; }
  list(): ReadonlyArray<AgentToolDefinition> { return [...this.tools.values()]; }
  toOpenAiTools(): ReadonlyArray<OpenAiTool> { return this.list().map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.inputSchema, strict: true } })); }
}
