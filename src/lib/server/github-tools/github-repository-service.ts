import "server-only";
import { selectRepository } from "./github-config";
import { githubRequest } from "./github-client";
import { validateRef } from "./github-path-policy";
import type { RepositoryRole } from "./github-tool-types";

type RepositoryApi = { id:number;private:boolean;default_branch:string };
type CommitApi = { sha:string;commit:{author:{date:string}|null} };

export async function resolveRepository(role: RepositoryRole, requestedRef?: string) {
  const repository = selectRepository(role);
  const ref = validateRef(requestedRef || repository.deploymentBranch || repository.defaultBranch, repository.allowedRefs);
  const prefix = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
  const [repoResult, commitResult] = await Promise.all([
    githubRequest<RepositoryApi>(repository, prefix, { cacheKey: "repository" }),
    githubRequest<CommitApi>(repository, `${prefix}/commits/${encodeURIComponent(ref)}`, { cacheKey: `commit:${ref}`, notFoundCode: "GITHUB_BRANCH_NOT_FOUND" }),
  ]);
  return { repository, ref, commit: commitResult.data.sha, commitAt: commitResult.data.commit.author?.date ?? null, repositoryApi: repoResult.data, cached: repoResult.cached && commitResult.cached, rateLimit: commitResult.rateLimit, checkedAt: commitResult.checkedAt };
}

export async function getRepositoryContext(role: RepositoryRole = "application", requestedRef?: string) {
  const resolved = await resolveRepository(role, requestedRef);
  const deployedCommit = process.env.DEPLOYED_COMMIT_SHA ?? process.env.BUILD_COMMIT_SHA ?? null;
  return {
    repositoryId: resolved.repository.id,
    owner: resolved.repository.owner,
    name: resolved.repository.name,
    role: resolved.repository.role,
    private: resolved.repositoryApi.private,
    defaultBranch: resolved.repositoryApi.default_branch,
    deploymentBranch: resolved.repository.deploymentBranch,
    ref: resolved.ref,
    commit: resolved.commit,
    commitAt: resolved.commitAt,
    deployedCommit,
    deploymentVerified: Boolean(deployedCommit && deployedCommit === resolved.commit),
    connectionStatus: "connected",
    cached: resolved.cached,
    rateLimit: resolved.rateLimit,
    checkedAt: resolved.checkedAt,
  };
}
