export const SECURITY_SCHEMA_VERSION="security-v1";
export const SECURITY_TABLES=["tq_security_user","tq_security_user_role","tq_security_resource_grant","tq_security_audit"] as const;
export const SECURITY_SEEDS=[{userId:"shared-user",organizationId:"default",role:"security_admin"}] as const;
