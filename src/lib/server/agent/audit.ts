type AuditEvent = Readonly<{ event: string; userId: string; conversationId: string; connectionId: number | null; tool?: string; ok?: boolean; durationMs?: number }>;
export function auditAgent(event: AuditEvent): void {
  // Deliberately metadata-only: prompts, credentials and tool payloads never enter logs.
  console.info(JSON.stringify({ scope: "agent_audit", at: new Date().toISOString(), ...event }));
}
