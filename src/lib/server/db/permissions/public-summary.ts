import type { DbPermissionCheckResult } from "./types";

function maskAccount(value: string | null): string {
  if (!value) return "확인하지 못함";
  const user = value.split("@")[0];
  return user.length <= 2 ? "**" : `${user.slice(0, 2)}${"*".repeat(Math.min(8, user.length - 2))}`;
}

export function toPublicPermissionSummary(result: DbPermissionCheckResult) {
  return {
    connectionId: result.connectionId,
    checkedAt: result.checkedAt,
    isReadOnly: result.readOnlyAssessment.isReadOnly,
    riskLevel: result.readOnlyAssessment.riskLevel,
    hostRestriction: result.authenticatedAccount.hostRestriction,
    accountLabel: maskAccount(result.authenticatedAccount.currentUser),
    allowedPrivileges: result.allowedPrivileges,
    riskyPrivileges: result.riskyPrivileges,
    unknownPrivileges: result.unknownPrivileges,
    hasGlobalPrivileges: result.scope.hasGlobalPrivileges,
    hasCrossDatabasePrivileges: result.scope.hasCrossDatabasePrivileges,
    metadataReadable: result.schemaAccess.metadataReadable,
    reasons: result.readOnlyAssessment.reasons,
    recommendations: result.readOnlyAssessment.recommendations,
  };
}
