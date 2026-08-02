import "server-only";
import { getCommitDetails, compareRepositoryRefs } from "@/lib/server/github-tools/github-commit-service";
import { getRepositoryContext } from "@/lib/server/github-tools/github-repository-service";
import { GitHubToolError } from "@/lib/server/github-tools/github-tool-types";
import { getDeploymentStatus } from "./deployment-status-service";
import { RuntimeToolError, type RuntimeProject } from "./runtime-tool-types";

export async function compareDeployedCommitWithRepository(project:RuntimeProject,ref?:string){
  const deployment=await getDeploymentStatus(project);if(!deployment.deployedCommit)throw new RuntimeToolError("DEPLOYMENT_COMMIT_UNKNOWN","실제 배포 commit이 기록되어 있지 않습니다.");
  try{
    const repository=await getRepositoryContext(project.repositoryRole,ref??project.branch);
    if(project.repositoryId&&repository.repositoryId!==project.repositoryId)throw new RuntimeToolError("DEPLOYMENT_REPOSITORY_MISMATCH","운영 프로젝트와 GitHub 저장소 연결이 일치하지 않습니다.");
    const deployed=await getCommitDetails({role:project.repositoryRole,commit:deployment.deployedCommit});
    if(deployed.repository.owner!==repository.owner||deployed.repository.name!==repository.name)throw new RuntimeToolError("DEPLOYMENT_REPOSITORY_MISMATCH","배포 commit이 연결 저장소에 속하지 않습니다.");
    if(deployed.commit===repository.commit)return{projectId:project.id,deployedCommit:deployed.commit,repositoryRef:repository.ref,repositoryLatestCommit:repository.commit,equal:true,ahead:0,behind:0,comparisonAvailable:true,commitExists:true,deployedAt:deployment.finishedAt,repositoryCommitAt:repository.commitAt,checkedAt:new Date().toISOString(),note:"배포 commit과 조회 ref의 최신 commit이 같습니다."};
    const comparison=await compareRepositoryRefs({role:project.repositoryRole,base:deployed.commit,head:repository.commit,limit:1});
    return{projectId:project.id,deployedCommit:deployed.commit,repositoryRef:repository.ref,repositoryLatestCommit:repository.commit,equal:false,ahead:comparison.ahead,behind:comparison.behind,comparisonAvailable:true,commitExists:true,deployedAt:deployment.finishedAt,repositoryCommitAt:repository.commitAt,checkedAt:new Date().toISOString(),note:"차이는 의도적인 고정 또는 이전 버전 배포일 수 있으므로 장애로 단정하지 않습니다."};
  }catch(error){if(error instanceof RuntimeToolError)throw error;if(error instanceof GitHubToolError&&error.code==="GITHUB_COMMIT_NOT_FOUND")return{projectId:project.id,deployedCommit:deployment.deployedCommit,repositoryRef:ref??project.branch,repositoryLatestCommit:null,equal:false,ahead:null,behind:null,comparisonAvailable:false,commitExists:false,deployedAt:deployment.finishedAt,repositoryCommitAt:null,checkedAt:new Date().toISOString(),note:"배포 commit을 연결된 GitHub 저장소에서 찾지 못했습니다."};throw error;}
}
