import "server-only";
import { RUNTIME_LIMITS, RuntimeToolError, type RuntimeProject } from "./runtime-tool-types";
import { sanitizeRuntimeText } from "./runtime-result-sanitizer";

export async function runProjectHealthCheck(project:RuntimeProject,checkType:"internal"|"external") {
  const target=healthTarget(project,checkType),started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),RUNTIME_LIMITS.healthTimeoutMs);
  try{
    const response=await fetch(target.url,{signal:controller.signal,redirect:"manual",headers:{"User-Agent":"TenaQueryDesk-runtime-health/1.0","Accept":"application/json,text/plain,text/html;q=0.5"}});
    const contentType=response.headers.get("content-type"),body=await limitedBody(response),summary=sanitizeRuntimeText(body,500).text.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    return {projectId:project.id,checkType,url:target.safeUrl,httpStatus:response.status,durationMs:Date.now()-started,contentType,redirect:response.status>=300&&response.status<400,finalHost:target.host,responseSummary:summary,healthy:response.status>=200&&response.status<300,checkedAt:new Date().toISOString(),cached:false};
  }catch(error){if(error instanceof Error&&error.name==="AbortError")throw new RuntimeToolError("RUNTIME_HEALTH_CHECK_TIMEOUT","프로젝트 health check 시간이 초과되었습니다.",true);throw new RuntimeToolError("RUNTIME_HEALTH_CHECK_FAILED","프로젝트 health check에 연결할 수 없습니다.",true,{reason:error instanceof TypeError?"connection_or_tls_error":"unknown"});}finally{clearTimeout(timer);}
}

function healthTarget(project:RuntimeProject,type:"internal"|"external"){
  if(type==="internal"){if(project.serverMode!=="local"||!project.expectedPort||!project.healthPath)throw new RuntimeToolError("RUNTIME_STATUS_NOT_SUPPORTED","내부 health check 설정이 없습니다.");return{url:`http://127.0.0.1:${project.expectedPort}${project.healthPath}`,safeUrl:`http://127.0.0.1:${project.expectedPort}${project.healthPath}`,host:"127.0.0.1"};}
  if(!project.externalHealthUrl)throw new RuntimeToolError("RUNTIME_STATUS_NOT_SUPPORTED","외부 health check 설정이 없습니다.");const url=new URL(project.externalHealthUrl);return{url:url.toString(),safeUrl:`https://${url.host}${url.pathname}`,host:url.host};
}
async function limitedBody(response:Response){if(!response.body)return"";const reader=response.body.getReader();let size=0,output="";while(size<RUNTIME_LIMITS.healthBodyBytes){const {done,value}=await reader.read();if(done)break;const take=value.slice(0,RUNTIME_LIMITS.healthBodyBytes-size);size+=take.length;output+=new TextDecoder().decode(take,{stream:true});if(take.length<value.length)break;}await reader.cancel().catch(()=>undefined);return output;}

export async function getReverseProxyStatus(project:RuntimeProject){if(!project.reverseProxyDomain||!project.externalHealthUrl)throw new RuntimeToolError("RUNTIME_REVERSE_PROXY_NOT_CONFIGURED","등록된 reverse proxy 상태 정보가 없습니다.");try{const health=await runProjectHealthCheck(project,"external");return{projectId:project.id,domain:project.reverseProxyDomain,configured:true,upstreamHost:"localhost",upstreamPort:project.expectedPort,expectedPortMatches:Boolean(project.expectedPort),externalStatus:health.httpStatus,healthy:health.healthy,checkedAt:health.checkedAt,configurationSource:"registered_project_metadata",certificateExpiresAt:null,reloadStatus:"unknown"};}catch(error){if(error instanceof RuntimeToolError)throw new RuntimeToolError("RUNTIME_REVERSE_PROXY_CHECK_FAILED",error.message,error.retryable);throw error;}}
