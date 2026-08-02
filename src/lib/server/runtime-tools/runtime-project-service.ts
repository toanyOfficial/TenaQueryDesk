import "server-only";
import { isAbsolute, normalize, resolve } from "node:path";
import { RuntimeToolError, type RuntimeProject, type RuntimeProjectRole } from "./runtime-tool-types";

const roles = new Set<RuntimeProjectRole>(["application", "worker", "documentation"]);
const safeId = /^[A-Za-z0-9_.-]{1,100}$/;

export function getRuntimeProjects(env: NodeJS.ProcessEnv = process.env): ReadonlyArray<RuntimeProject> {
  const raw = env.RUNTIME_PROJECTS_JSON?.trim();
  if (!raw) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 연결이 구성되지 않았습니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 설정 형식이 올바르지 않습니다."); }
  if (!Array.isArray(parsed)) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 설정 형식이 올바르지 않습니다.");
  return parsed.map((value) => parseProject(value));
}

function parseProject(value: unknown): RuntimeProject {
  if (!value || typeof value !== "object") throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 설정을 확인해 주세요.");
  const item = value as Record<string, unknown>;
  const required = ["id", "key", "displayName", "serverId", "deploymentPath", "pathAlias", "branch"];
  if (required.some(key => typeof item[key] !== "string") || !roles.has(item.role as RuntimeProjectRole)) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 필수 설정을 확인해 주세요.");
  if(String(item.displayName).length>160||/[\u0000-\u001f]/.test(String(item.displayName)))throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED","프로젝트 표시 이름 설정이 안전하지 않습니다.");
  if (![item.id,item.key,item.serverId,item.pathAlias,item.branch].every(value => safeId.test(String(value)))) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "운영 프로젝트 식별자 설정이 안전하지 않습니다.");
  if (!isAbsolute(String(item.deploymentPath))) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "배포 경로는 서버 설정의 절대 경로여야 합니다.");
  const expectedPort = item.expectedPort == null ? null : Number(item.expectedPort);
  if (expectedPort !== null && (!Number.isSafeInteger(expectedPort) || expectedPort < 1 || expectedPort > 65535)) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "expected port 설정이 올바르지 않습니다.");
  const connectionIds = Array.isArray(item.connectionIds) ? item.connectionIds.map(Number) : [];
  if (connectionIds.some(id => !Number.isSafeInteger(id) || id < 1)) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "DB connection 연결 설정이 올바르지 않습니다.");
  const healthPath = typeof item.healthPath === "string" ? item.healthPath : null;
  if (healthPath && (!healthPath.startsWith("/") || healthPath.includes("..") || healthPath.includes("://"))) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "health path 설정이 안전하지 않습니다.");
  const externalHealthUrl = validateExternalUrl(item.externalHealthUrl);
  return {
    id:String(item.id),key:String(item.key),displayName:String(item.displayName),role:item.role as RuntimeProjectRole,
    serverId:String(item.serverId),serverMode:item.serverMode === "remote" ? "remote" : "local",
    runtimeType:["node","bun","static","other"].includes(String(item.runtimeType)) ? item.runtimeType as RuntimeProject["runtimeType"] : "other",
    branch:String(item.branch),expectedPort,startMode:["systemd","process-manager","direct","remote-agent"].includes(String(item.startMode)) ? item.startMode as RuntimeProject["startMode"] : "unknown",
    runUser:typeof item.runUser === "string" ? item.runUser : null,deploymentPath:normalize(String(item.deploymentPath)),pathAlias:String(item.pathAlias),
    repositoryRole:["application","infrastructure","documentation","schema"].includes(String(item.repositoryRole)) ? item.repositoryRole as RuntimeProject["repositoryRole"] : "application",
    repositoryId:typeof item.repositoryId === "string" ? item.repositoryId : null,connectionIds:[...new Set(connectionIds)],healthPath,externalHealthUrl,
    reverseProxyDomain:validateDomain(item.reverseProxyDomain),
    reportRoot:typeof item.reportRoot === "string" && isAbsolute(item.reportRoot) ? resolve(item.reportRoot) : null,
    deploymentStateFile:typeof item.deploymentStateFile === "string" && isAbsolute(item.deploymentStateFile) ? resolve(item.deploymentStateFile) : null,
    active:item.active !== false,
  };
}

function validateExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error(); return url.toString(); }
  catch { throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED", "외부 health URL 설정이 안전하지 않습니다."); }
}
function validateDomain(value:unknown){if(typeof value!=="string"||!value)return null;if(!/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value))throw new RuntimeToolError("RUNTIME_PROJECT_NOT_CONNECTED","reverse proxy domain 설정이 안전하지 않습니다.");return value.toLowerCase();}

export function requireRuntimeProject(projectId: string, connectionId: number | null, projects = getRuntimeProjects()): RuntimeProject {
  if (!safeId.test(projectId)) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_FOUND", "운영 프로젝트를 찾을 수 없습니다.");
  const project = projects.find(item => item.id === projectId && item.active);
  if (!project) throw new RuntimeToolError("RUNTIME_PROJECT_NOT_FOUND", "운영 프로젝트를 찾을 수 없습니다.");
  if (!connectionId || !project.connectionIds.includes(connectionId)) throw new RuntimeToolError("RUNTIME_PROJECT_ACCESS_DENIED", "현재 DB connection에 연결된 운영 프로젝트가 아닙니다.");
  return project;
}

export function selectRuntimeProject(role: RuntimeProjectRole, connectionId: number | null, projects = getRuntimeProjects()): RuntimeProject {
  const matches = projects.filter(item => item.active && item.role === role && connectionId && item.connectionIds.includes(connectionId));
  if (matches.length !== 1) throw new RuntimeToolError(matches.length ? "RUNTIME_PROJECT_ACCESS_DENIED" : "RUNTIME_PROJECT_NOT_CONNECTED", matches.length ? "운영 프로젝트를 하나로 결정할 수 없습니다." : "현재 DB connection에 연결된 운영 프로젝트가 없습니다.");
  return matches[0];
}

export function publicProjectContext(project: RuntimeProject) {
  return { projectId:project.id,projectKey:project.key,displayName:project.displayName,serverId:project.serverId,serverMode:project.serverMode,runtimeType:project.runtimeType,branch:project.branch,expectedPort:project.expectedPort,startMode:project.startMode,pathAlias:project.pathAlias,reverseProxyDomain:project.reverseProxyDomain,repository:{id:project.repositoryId,role:project.repositoryRole},active:project.active,checkedAt:new Date().toISOString() };
}
