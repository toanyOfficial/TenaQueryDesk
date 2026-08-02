export const RUNTIME_LIMITS = Object.freeze({
  processScanLimit: 10_000,
  healthTimeoutMs: 5_000,
  healthBodyBytes: 2_048,
  reportBytes: 256_000,
  reportLines: 200,
  projectCacheMs: 30_000,
});

export type RuntimeType = "node" | "bun" | "static" | "other";
export type StartMode = "systemd" | "process-manager" | "direct" | "remote-agent" | "unknown";
export type RuntimeProjectRole = "application" | "worker" | "documentation";
export type DeploymentStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";

export type RuntimeProject = Readonly<{
  id: string;
  key: string;
  displayName: string;
  role: RuntimeProjectRole;
  serverId: string;
  serverMode: "local" | "remote";
  runtimeType: RuntimeType;
  branch: string;
  expectedPort: number | null;
  startMode: StartMode;
  runUser: string | null;
  deploymentPath: string;
  pathAlias: string;
  repositoryRole: "application" | "infrastructure" | "documentation" | "schema";
  repositoryId: string | null;
  connectionIds: ReadonlyArray<number>;
  healthPath: string | null;
  externalHealthUrl: string | null;
  reverseProxyDomain: string | null;
  reportRoot: string | null;
  deploymentStateFile: string | null;
  active: boolean;
}>;

export type RuntimeErrorCode =
  | "RUNTIME_PROJECT_NOT_CONNECTED" | "RUNTIME_PROJECT_NOT_FOUND" | "RUNTIME_PROJECT_ACCESS_DENIED"
  | "RUNTIME_SERVER_NOT_AVAILABLE" | "RUNTIME_STATUS_NOT_SUPPORTED" | "RUNTIME_PROCESS_NOT_FOUND"
  | "RUNTIME_PROCESS_MULTIPLE" | "RUNTIME_PROCESS_MISMATCH" | "RUNTIME_PORT_NOT_LISTENING"
  | "RUNTIME_PORT_PROCESS_MISMATCH" | "RUNTIME_HEALTH_CHECK_FAILED" | "RUNTIME_HEALTH_CHECK_TIMEOUT"
  | "RUNTIME_REVERSE_PROXY_NOT_CONFIGURED" | "RUNTIME_REVERSE_PROXY_CHECK_FAILED" | "DEPLOYMENT_NOT_FOUND"
  | "DEPLOYMENT_STATUS_UNKNOWN" | "DEPLOYMENT_REPORT_NOT_FOUND" | "DEPLOYMENT_REPORT_ACCESS_DENIED"
  | "DEPLOYMENT_REPORT_TOO_LARGE" | "DEPLOYMENT_COMMIT_UNKNOWN" | "DEPLOYMENT_REPOSITORY_MISMATCH"
  | "RUNTIME_COMMAND_TIMEOUT" | "RUNTIME_COMMAND_FAILED" | "RUNTIME_RESULT_TOO_LARGE";

export class RuntimeToolError extends Error {
  constructor(public readonly code: RuntimeErrorCode, message: string, public readonly retryable = false, public readonly details?: Readonly<Record<string, unknown>>) { super(message); }
}

export type DeploymentRecord = Readonly<{
  deploymentId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  status: DeploymentStatus;
  requestedBranch: string | null;
  requestedCommit: string | null;
  deployedCommit: string | null;
  previousSuccessfulCommit: string | null;
  stage: string | null;
  failedStage: string | null;
  errorSummary: string | null;
  reportAvailable: boolean;
  rollback: boolean;
}>;

export type RuntimeReference = Readonly<{
  projectId: string;
  projectKey: string;
  serverId: string;
  runtimeType: string;
  expectedPort: number | null;
  checkedAt: string;
  deploymentStatus: string | null;
  deployedCommit: string | null;
  processRunning: boolean | null;
  portListening: boolean | null;
  healthOk: boolean | null;
  deploymentId: string | null;
}>;
