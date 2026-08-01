import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { DatabaseRelationshipDocument, SchemaBundle, SchemaCurrentPointer, SchemaManifest, TableSchemaDocument } from "./types";
import { assertSafeSchemaRelativePath } from "./schema-current";
import { assertSafeConnectionKey } from "./write-schema-files";

export const MAX_SELECTED_TABLES = 12;
export const MAX_SCHEMA_CHARACTERS = 100_000;
const MAX_DISCOVERY_TABLES = 500;
const MAX_FILE_CHARACTERS = 1_000_000;

export type SchemaSelectionResult = Readonly<{
  database: Readonly<{ connectionId: number; connectionKey: string; displayName: string; dbType: "mysql"; databaseName: string }>;
  selectedTables: ReadonlyArray<string>; relatedTables: ReadonlyArray<string>;
  omittedTableCount: number; totalSerializedCharacters: number; serializedSchema: string;
}>;

function tokens(value: string): string[] {
  const base=value.toLocaleLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  const aliases:Record<string,ReadonlyArray<string>>={주문:["order","orders"],결제:["payment","payments","pay"],고객:["customer","customers","client","clients"],회원:["member","members","user","users"],상품:["product","products","item","items"],재고:["inventory","stock"],매장:["store","stores","shop"],배송:["delivery","shipping"],환불:["refund","refunds"],쿠폰:["coupon","coupons"]};
  for(const [k,values] of Object.entries(aliases)) if(base.some(token=>token.includes(k))) base.push(...values);
  return [...new Set(base)];
}
function scoreDocument(questionTokens: ReadonlyArray<string>, document: TableSchemaDocument): number {
  const tableText = `${document.table.name} ${document.table.comment}`.toLocaleLowerCase().normalize("NFKC");
  const columnText = document.table.columns.map((column) => `${column.name} ${column.comment}`).join(" ").toLocaleLowerCase().normalize("NFKC");
  const compact=(value:string)=>value.replace(/[^\p{L}\p{N}]+/gu,"");
  const compactTable=compact(tableText), compactColumns=compact(columnText);
  return questionTokens.reduce((score, token) => { const value=compact(token); return score + (compactTable.includes(value) ? 5 : 0) + (compactColumns.includes(value) ? 2 : 0); }, 0);
}
export function selectSchema(question: string, bundle: SchemaBundle): SchemaSelectionResult {
  const questionTokens = tokens(question);
  const ranked = bundle.tables.map((document) => ({ document, score: scoreDocument(questionTokens, document) })).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.document.table.name.localeCompare(right.document.table.name));
  if (ranked.length === 0) throw new Error("질문과 관련된 스키마를 찾지 못했습니다.");
  const primary = ranked.slice(0, MAX_SELECTED_TABLES).map(({ document }) => document.table.name);
  const selected = new Set(primary);
  const related: string[] = [];
  for (const relationship of bundle.relationships.relationships) {
    if (selected.size >= MAX_SELECTED_TABLES) break;
    const candidate = selected.has(relationship.sourceTable) ? relationship.targetTable : selected.has(relationship.targetTable) ? relationship.sourceTable : null;
    if (candidate && !selected.has(candidate) && bundle.tables.some((item) => item.table.name === candidate)) { selected.add(candidate); related.push(candidate); }
  }
  const documents: TableSchemaDocument[] = [];
  let serializedSchema = "";
  for (const name of selected) {
    const document = bundle.tables.find((item) => item.table.name === name);
    if (!document) continue;
    const next = JSON.stringify({ table: document.table, relationships: bundle.relationships.relationships.filter((relation) => relation.sourceTable === name || relation.targetTable === name) });
    if (serializedSchema.length + next.length > MAX_SCHEMA_CHARACTERS) continue;
    documents.push(document); serializedSchema += `${serializedSchema ? "\n" : ""}${next}`;
  }
  if (documents.length === 0) throw new Error("선별된 스키마가 전달 크기 제한을 초과했습니다.");
  const selectedTables = documents.map((document) => document.table.name);
  return { database: { connectionId: bundle.manifest.connectionId, connectionKey: bundle.manifest.connectionKey, displayName: bundle.manifest.displayName, dbType: bundle.manifest.dbType, databaseName: bundle.manifest.databaseName }, selectedTables, relatedTables: related.filter((name) => selectedTables.includes(name)), omittedTableCount: bundle.manifest.tableCount + bundle.manifest.viewCount - selectedTables.length, totalSerializedCharacters: serializedSchema.length, serializedSchema };
}

async function readJson<T>(file: string): Promise<T> {
  const content = await readFile(file, "utf8");
  if (content.length > MAX_FILE_CHARACTERS) throw new Error("스키마 파일이 허용 크기를 초과했습니다.");
  try { return JSON.parse(content) as T; } catch { throw new Error("선택한 DB의 스키마 파일이 손상되었습니다."); }
}
export async function loadSchemaBundle(connectionKey: string, relativeVersionPath: string, root = process.cwd()): Promise<SchemaBundle> {
  assertSafeSchemaRelativePath(connectionKey, relativeVersionPath);
  const schemaRoot = await realpath(path.join(root, "schemas"));
  const versionRoot = await realpath(path.join(root, relativeVersionPath));
  if (!versionRoot.startsWith(`${schemaRoot}${path.sep}`)) throw new Error("허용되지 않은 스키마 경로입니다.");
  const manifest = await readJson<SchemaManifest>(path.join(versionRoot, "manifest.json"));
  const relationships = await readJson<DatabaseRelationshipDocument>(path.join(versionRoot, "relationships.json"));
  if (manifest.formatVersion !== 1 || relationships.formatVersion !== 1 || manifest.connectionKey !== connectionKey || manifest.tables.length > MAX_DISCOVERY_TABLES) throw new Error("지원하지 않는 스키마 파일입니다.");
  const tables: TableSchemaDocument[] = [];
  for (const entry of manifest.tables) {
    if (!/^tables\/t-[0-9a-f]+\.json$/.test(entry.file)) throw new Error("허용되지 않은 테이블 스키마 경로입니다.");
    const document = await readJson<TableSchemaDocument>(path.join(versionRoot, entry.file));
    if (document.formatVersion !== 1 || document.table.name !== entry.name) throw new Error("스키마 manifest와 테이블 파일이 일치하지 않습니다.");
    tables.push(document);
  }
  return { manifest, relationships, tables };
}

/** Loads the published schema; flat files are accepted for compatibility with
 * schema collections created before versioned current pointers were enabled. */
export async function loadCurrentSchemaBundle(connectionKey: string, root = process.cwd()): Promise<SchemaBundle> {
  assertSafeConnectionKey(connectionKey);
  try {
    const pointer = await readJson<SchemaCurrentPointer>(path.join(root, "schemas", connectionKey, "current.json"));
    if (pointer.connectionKey !== connectionKey) throw new Error("최신 스키마 포인터가 연결과 일치하지 않습니다.");
    return loadSchemaBundle(connectionKey, `schemas/${connectionKey}/${pointer.path}`, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const directory = path.join(root, "schemas", connectionKey);
  const manifest = await readJson<SchemaManifest>(path.join(directory, "manifest.json"));
  const relationships = await readJson<DatabaseRelationshipDocument>(path.join(directory, "relationships.json"));
  if (manifest.connectionKey !== connectionKey || manifest.tables.length > MAX_DISCOVERY_TABLES) throw new Error("지원하지 않는 스키마 파일입니다.");
  const tables = await Promise.all(manifest.tables.map(async entry => {
    if (!/^tables\/t-[0-9a-f]+\.json$/.test(entry.file)) throw new Error("허용되지 않은 테이블 스키마 경로입니다.");
    const document=await readJson<TableSchemaDocument>(path.join(directory, entry.file));
    if(document.formatVersion!==1||document.table.name!==entry.name)throw new Error("스키마 manifest와 테이블 파일이 일치하지 않습니다.");
    return document;
  }));
  return { manifest, relationships, tables };
}
