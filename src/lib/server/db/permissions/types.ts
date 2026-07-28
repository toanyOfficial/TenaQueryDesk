export type DbPermissionRiskLevel = "safe" | "warning" | "critical" | "unknown";
export type HostRestriction = "restricted" | "wildcard" | "review" | "unknown";
export type ParsedGrant = Readonly<{ raw: string; privileges: ReadonlyArray<string>; scope: string | null; database: string | null; global: boolean; roleGrant: boolean; parseable: boolean }>;
export type DbPermissionCheckResult = Readonly<{
  connectionId: number; dbType: "mysql"; checkedAt: string;
  authenticatedAccount: Readonly<{ currentUser: string | null; loginUser: string | null; hostPattern: string | null; hostRestriction: HostRestriction }>;
  grants: ReadonlyArray<string>; allowedPrivileges: ReadonlyArray<string>; riskyPrivileges: ReadonlyArray<string>; unknownPrivileges: ReadonlyArray<string>;
  scope: Readonly<{ targetDatabase: string; hasTargetDatabaseSelect: boolean; hasGlobalPrivileges: boolean; hasCrossDatabasePrivileges: boolean }>;
  schemaAccess: Readonly<{ metadataReadable: boolean | null; viewDefinitionLikelyReadable: boolean; warnings: ReadonlyArray<string> }>;
  readOnlyAssessment: Readonly<{ isReadOnly: boolean; riskLevel: DbPermissionRiskLevel; reasons: ReadonlyArray<string>; recommendations: ReadonlyArray<string> }>;
}>;
