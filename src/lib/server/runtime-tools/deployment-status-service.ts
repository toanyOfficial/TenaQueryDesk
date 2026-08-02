import "server-only";
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { resolveSafeRuntimeFile } from "./runtime-path-policy";
import { sanitizeRuntimeText } from "./runtime-result-sanitizer";
import { RuntimeToolError, type DeploymentRecord, type DeploymentStatus, type RuntimeProject } from "./runtime-tool-types";

const statuses=new Set<DeploymentStatus>(["pending","running","succeeded","failed","cancelled","unknown"]);
export async function getDeploymentStatus(project:RuntimeProject):Promise<DeploymentRecord&{projectId:string;runtimeType:string;checkedAt:string;cached:false}>{
  if(!project.deploymentStateFile)return{projectId:project.id,runtimeType:project.runtimeType,...emptyDeployment(),checkedAt:new Date().toISOString(),cached:false};
  const safe=await resolveSafeRuntimeFile(dirname(project.deploymentStateFile),basename(project.deploymentStateFile));
  if(safe.size>256_000)throw new RuntimeToolError("RUNTIME_RESULT_TOO_LARGE","배포 상태 파일 크기 제한을 초과했습니다.");
  let value:unknown;try{value=JSON.parse(await readFile(safe.path,"utf8"));}catch{throw new RuntimeToolError("DEPLOYMENT_STATUS_UNKNOWN","배포 상태 정보를 해석할 수 없습니다.");}
  if(!value||typeof value!=="object")throw new RuntimeToolError("DEPLOYMENT_STATUS_UNKNOWN","배포 상태 정보 형식이 올바르지 않습니다.");
  const item=value as Record<string,unknown>,status=statuses.has(item.status as DeploymentStatus)?item.status as DeploymentStatus:"unknown",error=typeof item.errorSummary==="string"?sanitizeRuntimeText(item.errorSummary,1_000).text:null;
  return{projectId:project.id,runtimeType:project.runtimeType,deploymentId:stringOrNull(item.deploymentId),requestedAt:dateOrNull(item.requestedAt),startedAt:dateOrNull(item.startedAt),finishedAt:dateOrNull(item.finishedAt),status,requestedBranch:stringOrNull(item.requestedBranch),requestedCommit:commitOrNull(item.requestedCommit),deployedCommit:commitOrNull(item.deployedCommit),previousSuccessfulCommit:commitOrNull(item.previousSuccessfulCommit),stage:stringOrNull(item.stage),failedStage:stringOrNull(item.failedStage),errorSummary:error,reportAvailable:Boolean(item.reportAvailable),rollback:Boolean(item.rollback),checkedAt:new Date().toISOString(),cached:false};
}
function emptyDeployment():DeploymentRecord{return{deploymentId:null,requestedAt:null,startedAt:null,finishedAt:null,status:"unknown",requestedBranch:null,requestedCommit:null,deployedCommit:null,previousSuccessfulCommit:null,stage:null,failedStage:null,errorSummary:null,reportAvailable:false,rollback:false};}
const stringOrNull=(value:unknown)=>typeof value==="string"&&value.length<=500?value:null;
const commitOrNull=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{7,40}$/i.test(value)?value:null;
function dateOrNull(value:unknown){if(typeof value!=="string")return null;const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;}
