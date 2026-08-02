import "server-only";
import { readdir, readFile, readlink } from "node:fs/promises";
import { getProcessStatus } from "./process-status-service";
import { RUNTIME_LIMITS,RuntimeToolError, type RuntimeProject } from "./runtime-tool-types";
import { analyzePortEvidence } from "./runtime-status-analysis";

type Listener={protocol:"tcp"|"tcp6";address:string;port:number;inode:string};

export async function getPortStatus(project:RuntimeProject) {
  if(project.serverMode!=="local")throw new RuntimeToolError("RUNTIME_STATUS_NOT_SUPPORTED","원격 서버 상태 Agent가 구성되지 않았습니다.");
  if(!project.expectedPort)throw new RuntimeToolError("RUNTIME_STATUS_NOT_SUPPORTED","프로젝트 expected port가 등록되지 않았습니다.");
  const [tcp,tcp6,process]=await Promise.all([readListeners("/proc/net/tcp","tcp"),readListeners("/proc/net/tcp6","tcp6"),getProcessStatus(project)]);
  const listeners=[...tcp,...tcp6].filter(item=>item.port===project.expectedPort),owners=await findSocketOwners(new Set(listeners.map(item=>item.inode)));
  const evidence=analyzePortEvidence(listeners.length,owners.map(item=>item.pid),process.processes.map(item=>item.pid));
  const ownerPid=evidence.ownerPids[0]??null,ownerProcess=process.processes.find(item=>item.pid===ownerPid);
  return {projectId:project.id,expectedPort:project.expectedPort,...evidence,listeners:listeners.map(listener=>({address:listener.address,protocol:listener.protocol,pid:owners.find(owner=>owner.inode===listener.inode)?.pid??null})),pid:ownerPid,processName:ownerProcess?.commandSummary.split(" ")[0]??null,checkedAt:new Date().toISOString(),cached:false};
}

async function readListeners(path:string,protocol:"tcp"|"tcp6"):Promise<Listener[]>{
  try{const text=await readFile(path,"utf8");return text.trim().split("\n").slice(1).flatMap(line=>{const parts=line.trim().split(/\s+/);if(parts[3]!=="0A")return[];const [address,portHex]=parts[1].split(":");return[{protocol,address:decodeAddress(address,protocol),port:parseInt(portHex,16),inode:parts[9]}];});}catch{return[];}
}
function decodeAddress(hex:string,protocol:"tcp"|"tcp6"){if(protocol==="tcp"){const bytes=hex.match(/../g)?.reverse().map(value=>parseInt(value,16))??[];return bytes.join(".");}if(/^0+$/.test(hex))return"::";if(hex.endsWith("00000000000000000000000001000000"))return"::1";return"ipv6";}
async function findSocketOwners(inodes:Set<string>){if(!inodes.size)return[];const owners:Array<{pid:number;inode:string}>=[];let pids:string[]=[];try{pids=(await readdir("/proc")).filter(name=>/^\d+$/.test(name));}catch{return owners;}for(const pid of pids.slice(0,RUNTIME_LIMITS.processScanLimit)){let fds:string[]=[];try{fds=await readdir(`/proc/${pid}/fd`);}catch{continue;}for(const fd of fds){try{const link=await readlink(`/proc/${pid}/fd/${fd}`),match=link.match(/^socket:\[(\d+)\]$/);if(match&&inodes.has(match[1]))owners.push({pid:Number(pid),inode:match[1]});}catch{}}}return owners;}
