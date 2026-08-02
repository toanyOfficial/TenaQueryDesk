import "server-only";
import { readFile } from "node:fs/promises";
import { resolveSafeRuntimeFile, validateDeploymentId } from "./runtime-path-policy";
import { sanitizeRuntimeText } from "./runtime-result-sanitizer";
import { RUNTIME_LIMITS, RuntimeToolError, type RuntimeProject } from "./runtime-tool-types";

export async function getDeploymentReport(project:RuntimeProject,deploymentId:string,section:"summary"|"failure"|"stdout"|"stderr",maxLines:number){
  if(!project.reportRoot)throw new RuntimeToolError("DEPLOYMENT_REPORT_NOT_FOUND","이 프로젝트에는 배포 report 저장소가 연결되지 않았습니다.");
  const id=validateDeploymentId(deploymentId),safe=await resolveSafeRuntimeFile(project.reportRoot,`${id}.json`);
  if(safe.size>RUNTIME_LIMITS.reportBytes)throw new RuntimeToolError("DEPLOYMENT_REPORT_TOO_LARGE","배포 report 크기 제한을 초과했습니다.");
  let parsed:unknown;try{parsed=JSON.parse(await readFile(safe.path,"utf8"));}catch{throw new RuntimeToolError("DEPLOYMENT_REPORT_NOT_FOUND","배포 report 형식을 읽을 수 없습니다.");}
  if(!parsed||typeof parsed!=="object")throw new RuntimeToolError("DEPLOYMENT_REPORT_NOT_FOUND","배포 report 형식이 올바르지 않습니다.");
  const item=parsed as Record<string,unknown>;if(item.projectId!==project.id||item.deploymentId!==id)throw new RuntimeToolError("DEPLOYMENT_REPORT_ACCESS_DENIED","현재 프로젝트의 배포 report가 아닙니다.");
  const limit=Math.min(Math.max(maxLines,1),RUNTIME_LIMITS.reportLines),raw=sectionText(item,section),lines=raw.split(/\r?\n/),selected=lines.slice(0,limit),safeText=sanitizeRuntimeText(selected.join("\n"),40_000);
  return{projectId:project.id,deploymentId:id,createdAt:typeof item.createdAt==="string"?item.createdAt:null,status:typeof item.status==="string"?item.status:"unknown",requestedCommit:validCommit(item.requestedCommit),deployedCommit:validCommit(item.deployedCommit),failedStage:typeof item.failedStage==="string"?item.failedStage:null,section,content:safeText.text,truncated:lines.length>selected.length||safeText.truncated,lineCount:selected.length,checkedAt:new Date().toISOString(),cached:false};
}
function sectionText(item:Record<string,unknown>,section:string){const value=section==="failure"?(item.failure??item.stderr??item.errorSummary):item[section];return typeof value==="string"?value:Array.isArray(value)?value.filter(line=>typeof line==="string").join("\n"):"";}
const validCommit=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{7,40}$/i.test(value)?value:null;
