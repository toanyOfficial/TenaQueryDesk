import "server-only";
import { Buffer } from "node:buffer";
import { extname } from "node:path";
import { githubRequest } from "./github-client";
import { assertTextContent, isExcludedPath, validateRepositoryPath } from "./github-path-policy";
import { resolveRepository } from "./github-repository-service";
import { sanitizeSource } from "./github-result-sanitizer";
import { GITHUB_LIMITS, GitHubToolError, type RepositoryRole } from "./github-tool-types";

type TreeItem = { path:string;type:"blob"|"tree"|"commit";size?:number;sha:string };
type TreeApi = { tree:TreeItem[];truncated:boolean };
type ContentApi = { type:string;size:number;sha:string;encoding:string;content:string };
type SearchApi = { items:Array<{path:string;sha:string;text_matches?:Array<{fragment:string;matches:Array<{text:string}>}>}> };

const repoPrefix = (owner:string, name:string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
const language = (path:string) => ({ ".ts":"TypeScript", ".tsx":"TypeScript JSX", ".js":"JavaScript", ".jsx":"JavaScript JSX", ".md":"Markdown", ".json":"JSON", ".css":"CSS", ".sql":"SQL" } as Record<string,string>)[extname(path).toLowerCase()] ?? "text";

export async function listRepositoryTree(input: { role?:RepositoryRole;path?:string;ref?:string;depth?:number;limit?:number }) {
  const resolved = await resolveRepository(input.role ?? "application", input.ref);
  const path = validateRepositoryPath(input.path ?? "");
  const depth = Math.min(Math.max(input.depth ?? 2, 0), GITHUB_LIMITS.treeDepth);
  const limit = Math.min(Math.max(input.limit ?? GITHUB_LIMITS.treeItems, 1), GITHUB_LIMITS.treeItems);
  const result = await githubRequest<TreeApi>(resolved.repository, `${repoPrefix(resolved.repository.owner,resolved.repository.name)}/git/trees/${resolved.commit}?recursive=1`, { cacheKey:`tree:${resolved.commit}` });
  const prefix = path ? `${path}/` : "";
  const items = result.data.tree.filter(item => item.path.startsWith(prefix) && item.path !== path && item.path.slice(prefix.length).split("/").length <= depth && !isExcludedPath(item.path)).slice(0, limit);
  return { repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},ref:resolved.ref,commit:resolved.commit,path,items:items.map(item=>({path:item.path,type:item.type === "commit" ? "submodule" : item.type === "tree" ? "directory" : "file",size:item.size??null,extension:extname(item.path)||null})),truncated:result.data.truncated || items.length === limit,cached:result.cached,rateLimit:result.rateLimit };
}

export async function readRepositoryFile(input: { role?:RepositoryRole;path:string;ref?:string;startLine?:number;endLine?:number }) {
  const resolved = await resolveRepository(input.role ?? "application", input.ref);
  const path = validateRepositoryPath(input.path, false);
  const result = await githubRequest<ContentApi>(resolved.repository, `${repoPrefix(resolved.repository.owner,resolved.repository.name)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(resolved.commit)}`, { cacheKey:`file:${resolved.commit}:${path}`,notFoundCode:"GITHUB_FILE_NOT_FOUND" });
  if (result.data.type !== "file") throw new GitHubToolError("GITHUB_FILE_NOT_FOUND", "요청 경로는 파일이 아닙니다.");
  if (result.data.size > GITHUB_LIMITS.fileBytes) throw new GitHubToolError("GITHUB_FILE_TOO_LARGE", "파일 크기 제한을 초과했습니다.");
  const buffer = Buffer.from(result.data.content.replace(/\n/g,""), result.data.encoding === "base64" ? "base64" : "utf8");
  assertTextContent(buffer);
  const lines = sanitizeSource(buffer.toString("utf8")).split(/\r?\n/);
  const startLine = Math.max(input.startLine ?? 1, 1);
  const requestedEnd = Math.max(input.endLine ?? Math.min(lines.length,startLine+GITHUB_LIMITS.fileLines-1),startLine);
  const endLine = Math.min(requestedEnd, startLine + GITHUB_LIMITS.fileLines - 1, lines.length);
  return { repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},ref:resolved.ref,commit:resolved.commit,path,language:language(path),startLine,endLine,totalLines:lines.length,content:lines.slice(startLine-1,endLine).join("\n"),truncated:endLine<lines.length,blobSha:result.data.sha,cached:result.cached,contentTrust:"untrusted_repository_data",lfsPointer:lines[0]?.includes("git-lfs.github.com/spec")??false,rateLimit:result.rateLimit };
}

export async function searchRepositoryCode(input:{role?:RepositoryRole;query:string;path?:string;ref?:string;limit?:number}) {
  const resolved = await resolveRepository(input.role ?? "application", input.ref);
  const query = input.query.trim();
  if (!query || query.length > 300) throw new GitHubToolError("GITHUB_SEARCH_FAILED", "검색어는 1자 이상 300자 이하로 입력해 주세요.");
  const path = input.path ? validateRepositoryPath(input.path) : "";
  const limit = Math.min(Math.max(input.limit ?? 20,1),GITHUB_LIMITS.searchResults);
  const qualifier = `${query} repo:${resolved.repository.owner}/${resolved.repository.name}${path?` path:${path}`:""}`;
  const result = await githubRequest<SearchApi>(resolved.repository, `/search/code?q=${encodeURIComponent(qualifier)}&per_page=${limit}`, { cacheKey:`search:${resolved.commit}:${qualifier}:${limit}` });
  return { repository:{owner:resolved.repository.owner,name:resolved.repository.name,role:resolved.repository.role},ref:resolved.ref,commit:resolved.commit,matches:result.data.items.filter(item=>!isExcludedPath(item.path)).slice(0,limit).map(item=>({path:item.path,blobSha:item.sha,snippet:sanitizeSource(item.text_matches?.[0]?.fragment??""),matchReason:item.text_matches?.[0]?.matches?.map(match=>match.text)??["path_or_content"],matchType:"github_code_search"})),truncated:result.data.items.length>limit,cached:result.cached,rateLimit:result.rateLimit };
}

export async function findRepositoryReferences(input:{role?:RepositoryRole;symbol:string;path?:string;ref?:string;limit?:number}) {
  const result=await searchRepositoryCode({...input,query:input.symbol});
  return {...result,matchMode:"text_search_not_semantic",matches:result.matches.map(match=>({...match,classification:/\b(?:import|require)\b/.test(match.snippet)?"import":new RegExp(`(?:function|class|const|let|var)\\s+${input.symbol.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(match.snippet)?"definition_candidate":"reference_candidate"}))};
}
