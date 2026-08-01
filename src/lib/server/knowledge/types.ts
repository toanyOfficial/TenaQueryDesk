export type KnowledgeStatus="active"|"draft"|"deprecated"|"archived";
export type KnowledgeMetadata=Readonly<{id:string;title:string;category:string;tags:ReadonlyArray<string>;status:KnowledgeStatus;updatedAt:string;version:number;audience:ReadonlyArray<string>;relatedDocuments:ReadonlyArray<string>;relatedTools:ReadonlyArray<string>;relatedRoutes:ReadonlyArray<string>;sourceOfTruth:boolean;summary:string}>;
export type KnowledgeSection=Readonly<{title:string;level:number;start:number;end:number}>;
export type KnowledgeDocument=Readonly<{metadata:KnowledgeMetadata;relativePath:string;body:string;sections:ReadonlyArray<KnowledgeSection>;contentHash:string;searchText:string}>;
export type KnowledgeIndex=Readonly<{documents:ReadonlyArray<KnowledgeDocument>;lastIndexedAt:string;contentHash:string}>;
export type KnowledgeErrorCode="KNOWLEDGE_ROOT_NOT_FOUND"|"KNOWLEDGE_INDEX_NOT_READY"|"KNOWLEDGE_INDEX_FAILED"|"KNOWLEDGE_DOCUMENT_NOT_FOUND"|"KNOWLEDGE_DOCUMENT_DUPLICATED"|"KNOWLEDGE_DOCUMENT_INVALID_METADATA"|"KNOWLEDGE_DOCUMENT_TOO_LARGE"|"KNOWLEDGE_SECTION_NOT_FOUND"|"KNOWLEDGE_PATH_NOT_ALLOWED"|"KNOWLEDGE_RESULT_TOO_LARGE"|"KNOWLEDGE_TOOL_TIMEOUT";
export class KnowledgeError extends Error{constructor(readonly code:KnowledgeErrorCode,message:string,readonly retryable:boolean,readonly details?:Readonly<Record<string,unknown>>){super(message);this.name="KnowledgeError";}}
