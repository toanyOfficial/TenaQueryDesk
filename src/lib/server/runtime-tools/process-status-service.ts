import "server-only";
import { readdir, readFile, readlink, realpath } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { RUNTIME_LIMITS,RuntimeToolError, type RuntimeProject } from "./runtime-tool-types";
import { summarizeProcessEvidence } from "./runtime-status-analysis";

type Proc = {pid:number;ppid:number;pgid:number;user:string|null;state:string;zombie:boolean;startedAt:string|null;uptimeSeconds:number|null;commandSummary:string;runtimeMatches:boolean;userMatches:boolean};

export async function getProcessStatus(project: RuntimeProject) {
  if (project.serverMode !== "local") throw new RuntimeToolError("RUNTIME_STATUS_NOT_SUPPORTED", "원격 서버 상태 Agent가 구성되지 않았습니다.");
  const checkedAt = new Date().toISOString();
  let entries: string[];
  try { entries = (await readdir("/proc")).filter(name => /^\d+$/.test(name)); } catch { throw new RuntimeToolError("RUNTIME_SERVER_NOT_AVAILABLE", "서버 프로세스 정보를 조회할 수 없습니다.", true); }
  const projectRoot=await realpath(project.deploymentPath).catch(()=>{throw new RuntimeToolError("RUNTIME_SERVER_NOT_AVAILABLE","등록된 프로젝트 배포 경로를 확인할 수 없습니다.");}),processes: Proc[]=[];
  for (const name of entries.slice(0,RUNTIME_LIMITS.processScanLimit)) {
    const process = await inspectProcess(Number(name), project,projectRoot).catch(() => null);
    if (process) processes.push(process);
  }
  return { projectId:project.id,...summarizeProcessEvidence(processes),processes,checkedAt,cached:false,warnings:[...(processes.length===0?["등록된 배포 경로에서 실행 중인 프로세스를 찾지 못했습니다."]:[]),...(processes.length>1?["동일 프로젝트 배포 경로의 프로세스가 여러 개 발견되었습니다."]:[])] };
}

async function inspectProcess(pid:number, project:RuntimeProject,projectRoot:string): Promise<Proc|null> {
  const root=`/proc/${pid}`;
  const cwd=resolve(await readlink(`${root}/cwd`));
  const rel=relative(projectRoot,cwd);
  if (rel.startsWith("..") || rel.startsWith("/")) return null;
  const [status,stat,cmdline,uptimeRaw]=await Promise.all([readFile(`${root}/status`,"utf8"),readFile(`${root}/stat`,"utf8"),readFile(`${root}/cmdline`,"utf8").catch(()=>""),readFile("/proc/uptime","utf8")]);
  const state=status.match(/^State:\s+([^\s]+)/m)?.[1]??"unknown",ppid=Number(status.match(/^PPid:\s+(\d+)/m)?.[1]??0),uid=status.match(/^Uid:\s+(\d+)/m)?.[1]??null;
  const after=stat.slice(stat.lastIndexOf(")")+2).split(" "),pgid=Number(after[2]??0),startTicks=Number(after[19]??NaN),systemUptime=Number(uptimeRaw.split(" ")[0]),clockTicks=100;
  const command=cmdline.split("\0").filter(Boolean),executable=basename(command[0]??"");
  const user=uid?await usernameForUid(uid):null,uptimeSeconds=Number.isFinite(startTicks)?Math.max(0,Math.floor(systemUptime-startTicks/clockTicks)):null;
  return {pid,ppid,pgid,user,state,zombie:state==="Z",startedAt:uptimeSeconds===null?null:new Date(Date.now()-uptimeSeconds*1000).toISOString(),uptimeSeconds,commandSummary:[executable,...command.slice(1,2).map(value=>basename(value))].join(" ").slice(0,200),runtimeMatches:project.runtimeType==="other"||project.runtimeType==="static"||executable.toLowerCase().includes(project.runtimeType),userMatches:!project.runUser||project.runUser===user};
}

async function usernameForUid(uid:string){try{const passwd=await readFile("/etc/passwd","utf8");return passwd.split("\n").find(line=>line.split(":")[2]===uid)?.split(":")[0]??null;}catch{return null;}}
