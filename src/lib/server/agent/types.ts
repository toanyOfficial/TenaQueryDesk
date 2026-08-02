import type { TargetConnection } from "@/lib/server/db/target-connections";

export type JsonSchema = Readonly<Record<string, unknown>>;
export type AgentMessage =
  | Readonly<{ role: "system" | "user"; content: string }>
  | Readonly<{ role: "assistant"; content: string | null; toolCalls?: ReadonlyArray<AgentToolCall> }>
  | Readonly<{ role: "tool"; toolCallId: string; content: string }>;
export type AgentToolCall = Readonly<{ id: string; name: string; arguments: string }>;
export type AgentModelTurn =
  | Readonly<{ type: "final"; value: unknown }>
  | Readonly<{ type: "tool_calls"; calls: ReadonlyArray<AgentToolCall> }>;
export type AgentModelClient = Readonly<{ complete(messages: ReadonlyArray<AgentMessage>, tools: ReadonlyArray<OpenAiTool>, options?: Readonly<{ forceFinal?: boolean }>): Promise<AgentModelTurn> }>;
export type OpenAiTool = Readonly<{ type: "function"; function: Readonly<{ name: string; description: string; parameters: JsonSchema; strict: true }> }>;

export type ToolContext = Readonly<{ userId: string; conversationId: string; connectionId: number | null; connection: TargetConnection | null; executionApproved?: boolean }>;
export type AgentToolDefinition = Readonly<{ name: string; description: string; inputSchema: JsonSchema; requiresConnection: boolean; timeoutMs: number; timeoutErrorCode?:string; maxResultCharacters: number; sensitiveKeys: ReadonlyArray<string>; execute(context: ToolContext, input: Readonly<Record<string, unknown>>): Promise<unknown> }>;
export type ToolResult =
  | Readonly<{ ok: true; tool: string; data: unknown; meta: Readonly<{ durationMs: number; truncated: boolean }> }>
  | Readonly<{ ok: false; tool: string; error: Readonly<{ code: string; message: string; retryable: boolean; details?: Readonly<Record<string,unknown>> }>; meta: Readonly<{ durationMs: number }> }>;
export type AgentToolUsage = Readonly<{ name: string; ok: boolean; durationMs: number }>;

export type RunAgentInput = Readonly<{ userId: string; connectionId: number | null; conversationId: string; userMessage: string; connection: TargetConnection | null; previousMessages?: ReadonlyArray<AgentMessage> }>;
export type BusinessKnowledgeReference = Readonly<{id:string;title:string;version:number;type:string;appliedRules:ReadonlyArray<string>}>;
export type GitHubReference = Readonly<{repository:Readonly<{id:string;owner:string;name:string;role:string;ref:string;commit:string;deployedCommit:string|null;deploymentVerified:boolean}>|null;files:ReadonlyArray<Readonly<{path:string;startLine:number;endLine:number;ref:string;commit:string;cached:boolean}>>}>;
export type RuntimeReference = Readonly<{projectId:string;projectKey:string;serverId:string;runtimeType:string;expectedPort:number|null;checkedAt:string;deploymentStatus:string|null;deployedCommit:string|null;processRunning:boolean|null;portListening:boolean|null;healthOk:boolean|null;deploymentId:string|null}>;
export type UiReference = Readonly<{projectId:string;environment:string;path:string;pageTitle:string|null;checkedAt:string;elements:ReadonlyArray<Readonly<{role:string;name:string;visible:boolean;enabled:boolean}>>;networkErrorCount:number;consoleErrorCount:number;screenshotAvailable:boolean;deployedCommit:string|null;mutationBlocked:boolean}>;
export type RunAgentResult = Readonly<{ answer: string; sql: string | null; warnings: ReadonlyArray<string>; toolsUsed: ReadonlyArray<AgentToolUsage>; references:Readonly<{schemaVersion:string|null;tables:ReadonlyArray<string>;documents:ReadonlyArray<Readonly<{id:string;title:string;version:number;updatedAt:string;status:string}>>;businessKnowledge:ReadonlyArray<BusinessKnowledgeReference>;github:GitHubReference;runtime:RuntimeReference|null;ui:UiReference|null;toolsUsed:ReadonlyArray<string>}>; conversationId: string; metadata: Readonly<{ iterations: number; completedReason: "final_answer" | "limit_reached" }> }>;
