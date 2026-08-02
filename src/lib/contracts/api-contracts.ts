export const API_CONTRACT_VERSION="v1";
export const API_CONTRACTS=[
 {path:"/api/analysis/generate",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"legacy-agent"},
 {path:"/api/analysis/history",methods:["GET"],authenticated:true,mutation:false,errorEnvelope:"legacy"},
 {path:"/api/analysis/history/[id]",methods:["GET"],authenticated:true,mutation:false,errorEnvelope:"legacy"},
 {path:"/api/analysis/conversations/[id]/reset",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"legacy"},
 {path:"/api/db-connections",methods:["GET","POST"],authenticated:true,mutation:true,errorEnvelope:"mixed"},
 {path:"/api/db-connections/[id]/schema/collect",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"mixed"},
 {path:"/api/admin/business-knowledge",methods:["GET","POST"],authenticated:true,mutation:true,errorEnvelope:"legacy"},
 {path:"/api/query/execute",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"query"},
 {path:"/api/admin/security/users",methods:["GET"],authenticated:true,mutation:false,errorEnvelope:"security"},
 {path:"/api/admin/security/roles",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"security"},
 {path:"/api/admin/security/grants",methods:["POST"],authenticated:true,mutation:true,errorEnvelope:"security"},
 {path:"/api/admin/security/simulate",methods:["POST"],authenticated:true,mutation:false,errorEnvelope:"security"},
 {path:"/api/admin/security/audit",methods:["GET"],authenticated:true,mutation:false,errorEnvelope:"security"},
 {path:"/api/admin/quality/status",methods:["GET"],authenticated:true,mutation:false,errorEnvelope:"security"}
] as const;
