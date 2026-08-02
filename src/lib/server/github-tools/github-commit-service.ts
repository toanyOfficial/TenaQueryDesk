import "server-only";
import { githubRequest } from "./github-client";
import { validateRef, validateRepositoryPath } from "./github-path-policy";
import { resolveRepository } from "./github-repository-service";
import { GITHUB_LIMITS, GitHubToolError, type RepositoryRole } from "./github-tool-types";

type CommitSummary = { sha:string;commit:{message:string;author:{name:string;date:string}|null};parents?:Array<{sha:string}>;files?:Array<{filename:string;status:string;additions:number;deletions:number}> };
const prefix=(owner:string,name:string)=>`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

export async function getFileHistory(input:{role?:RepositoryRole;path:string;ref?:string;limit?:number}) {
  const resolved=await resolveRepository(input.role??"application",input.ref),path=validateRepositoryPath(input.path,false),limit=Math.min(Math.max(input.limit??10,1),GITHUB_LIMITS.historyItems);
  const result=await githubRequest<CommitSummary[]>(resolved.repository,`${prefix(resolved.repository.owner,resolved.repository.name)}/commits?sha=${encodeURIComponent(resolved.ref)}&path=${encodeURIComponent(path)}&per_page=${limit}`,{cacheKey:`history:${resolved.commit}:${path}:${limit}`});
  return {repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},ref:resolved.ref,commit:resolved.commit,path,history:result.data.map(item=>({commit:item.sha,title:item.commit.message.split("\n")[0],author:item.commit.author?.name??"unknown",committedAt:item.commit.author?.date??null,changed:true})),cached:result.cached,rateLimit:result.rateLimit};
}

export async function getCommitDetails(input:{role?:RepositoryRole;commit:string}) {
  const resolved=await resolveRepository(input.role??"application");
  if(!/^[0-9a-f]{7,40}$/i.test(input.commit))throw new GitHubToolError("GITHUB_COMMIT_NOT_FOUND","commit 형식이 올바르지 않습니다.");
  const result=await githubRequest<CommitSummary>(resolved.repository,`${prefix(resolved.repository.owner,resolved.repository.name)}/commits/${encodeURIComponent(input.commit)}`,{cacheKey:`details:${input.commit}`,notFoundCode:"GITHUB_COMMIT_NOT_FOUND"});
  const files=(result.data.files??[]).slice(0,GITHUB_LIMITS.commitFiles);
  return {repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},commit:result.data.sha,title:result.data.commit.message.split("\n")[0],description:result.data.commit.message.split("\n").slice(1).join("\n").trim(),author:result.data.commit.author?.name??"unknown",committedAt:result.data.commit.author?.date??null,parents:(result.data.parents??[]).map(parent=>parent.sha),files:files.map(file=>({path:file.filename,status:file.status,additions:file.additions,deletions:file.deletions})),truncated:(result.data.files?.length??0)>files.length,cached:result.cached,rateLimit:result.rateLimit};
}

type CompareApi={ahead_by:number;behind_by:number;base_commit:{sha:string};merge_base_commit:{sha:string};commits:Array<{sha:string}>;files?:Array<{filename:string;status:string;additions:number;deletions:number}>};
export async function compareRepositoryRefs(input:{role?:RepositoryRole;base:string;head:string;path?:string;limit?:number}) {
  const resolved=await resolveRepository(input.role??"application"),base=validateRef(input.base,resolved.repository.allowedRefs),head=validateRef(input.head,resolved.repository.allowedRefs),path=input.path?validateRepositoryPath(input.path):"",limit=Math.min(Math.max(input.limit??100,1),GITHUB_LIMITS.compareFiles);
  let result;try{result=await githubRequest<CompareApi>(resolved.repository,`${prefix(resolved.repository.owner,resolved.repository.name)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,{cacheKey:`compare:${base}:${head}`});}catch(error){if(error instanceof GitHubToolError&&error.code==="GITHUB_API_FAILED")throw new GitHubToolError("GITHUB_COMPARE_FAILED","GitHub ref 비교를 완료하지 못했습니다.");throw error;}
  const all=(result.data.files??[]).filter(file=>!path||file.filename===path||file.filename.startsWith(`${path}/`)),files=all.slice(0,limit);
  return {repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},base,head,ahead:result.data.ahead_by,behind:result.data.behind_by,baseCommit:result.data.base_commit.sha,mergeBaseCommit:result.data.merge_base_commit.sha,headCommit:result.data.commits.at(-1)?.sha??result.data.base_commit.sha,files:files.map(file=>({path:file.filename,status:file.status,additions:file.additions,deletions:file.deletions})),truncated:all.length>files.length,cached:result.cached,rateLimit:result.rateLimit};
}
