import "server-only";
import { lstat, realpath } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { RuntimeToolError } from "./runtime-tool-types";

const deploymentIdPattern=/^[A-Za-z0-9_-]{1,100}$/;
export function validateDeploymentId(value:string){if(!deploymentIdPattern.test(value))throw new RuntimeToolError("DEPLOYMENT_REPORT_ACCESS_DENIED","배포 ID 형식이 올바르지 않습니다.");return value;}
export async function resolveSafeRuntimeFile(root:string,file:string){
  const canonicalRoot=await realpath(root).catch(()=>{throw new RuntimeToolError("DEPLOYMENT_REPORT_NOT_FOUND","배포 report 저장소를 찾을 수 없습니다.");});
  const candidate=resolve(root,file),rel=relative(canonicalRoot,candidate);
  if(rel.startsWith("..")||rel.startsWith("/")||![".json",".txt",".log"].includes(extname(candidate).toLowerCase()))throw new RuntimeToolError("DEPLOYMENT_REPORT_ACCESS_DENIED","허용된 report 파일이 아닙니다.");
  const info=await lstat(candidate).catch(()=>{throw new RuntimeToolError("DEPLOYMENT_REPORT_NOT_FOUND","배포 report를 찾을 수 없습니다.");});
  if(info.isSymbolicLink()||!info.isFile())throw new RuntimeToolError("DEPLOYMENT_REPORT_ACCESS_DENIED","배포 report 파일을 읽을 수 없습니다.");
  const canonical=await realpath(candidate),finalRel=relative(canonicalRoot,canonical);if(finalRel.startsWith("..")||finalRel.startsWith("/"))throw new RuntimeToolError("DEPLOYMENT_REPORT_ACCESS_DENIED","배포 report 경로가 허용 범위를 벗어났습니다.");
  return{path:canonical,size:info.size};
}
