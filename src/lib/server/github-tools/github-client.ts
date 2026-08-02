import "server-only";
import { GITHUB_LIMITS, GitHubToolError, type GitHubRepositoryConfig, type GitHubResponse, type RateLimit } from "./github-tool-types";

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function rateLimit(headers: Headers): RateLimit {
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt: Number.isFinite(reset) ? new Date(reset * 1000).toISOString() : null,
    low: Number.isFinite(remaining) && remaining < 50,
  };
}

function apiError(status: number, rate: RateLimit, notFoundCode?: "GITHUB_FILE_NOT_FOUND" | "GITHUB_COMMIT_NOT_FOUND" | "GITHUB_BRANCH_NOT_FOUND"): never {
  if (status === 429 || (status === 403 && rate.remaining === 0)) throw new GitHubToolError("GITHUB_RATE_LIMIT_EXCEEDED", "GitHub API 호출 한도를 초과했습니다.", false, { resetAt: rate.resetAt });
  if (status === 401 || status === 403) throw new GitHubToolError("GITHUB_REPOSITORY_ACCESS_DENIED", "연결된 GitHub 저장소를 조회할 권한이 없습니다.");
  if (status === 404) throw new GitHubToolError(notFoundCode ?? "GITHUB_REPOSITORY_NOT_FOUND", "요청한 GitHub 리소스를 찾을 수 없습니다.");
  throw new GitHubToolError("GITHUB_API_FAILED", "GitHub API 요청을 완료하지 못했습니다.", status >= 500);
}

export async function githubRequest<T>(repository: GitHubRepositoryConfig, apiPath: string, options: Readonly<{ cacheKey?: string; notFoundCode?: "GITHUB_FILE_NOT_FOUND" | "GITHUB_COMMIT_NOT_FOUND" | "GITHUB_BRANCH_NOT_FOUND" }> = {}): Promise<GitHubResponse<T>> {
  const key = options.cacheKey ? `${repository.id}:${options.cacheKey}` : null;
  const found = key ? cache.get(key) : undefined;
  if (found && found.expiresAt > Date.now()) return { data: found.value as T, rateLimit: { remaining: null, resetAt: null, low: false }, cached: true, checkedAt: new Date().toISOString() };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_LIMITS.requestTimeoutMs);
  try {
    const response = await fetch(`https://api.github.com${apiPath}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "TenaQueryDesk-readonly-source-explorer",
        ...(repository.token ? { Authorization: `Bearer ${repository.token}` } : {}),
      },
    });
    const rate = rateLimit(response.headers);
    if (!response.ok) apiError(response.status, rate, options.notFoundCode);
    const data = await response.json() as T;
    if (key) cache.set(key, { value: data, expiresAt: Date.now() + GITHUB_LIMITS.cacheTtlMs });
    return { data, rateLimit: rate, cached: false, checkedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof GitHubToolError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new GitHubToolError("GITHUB_API_TIMEOUT", "GitHub API 응답 시간이 초과되었습니다.", true);
    throw new GitHubToolError("GITHUB_API_FAILED", "GitHub API 요청을 완료하지 못했습니다.", true);
  } finally {
    clearTimeout(timeout);
  }
}

export function clearGitHubCacheForTests() { cache.clear(); }
