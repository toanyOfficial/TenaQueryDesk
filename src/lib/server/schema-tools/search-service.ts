import type { SchemaBundle, TableSchemaDocument } from "@/lib/server/schema/types";
import { SchemaToolError } from "./types";

export const normalizeSchemaSearch=(value:string)=>value.normalize("NFKC").replace(/([a-z0-9])([A-Z])/g,"$1 $2").toLocaleLowerCase().replace(/[_\-\s]+/g," ").replace(/[^\p{L}\p{N} ]+/gu," ").trim();
const compact=(value:string)=>normalizeSchemaSearch(value).replace(/\s+/g,"");
const queryTokens=(query:string)=>[...new Set(normalizeSchemaSearch(query).split(/\s+/).filter(token=>token.length>=1))];
export type SchemaSearchMatch=Readonly<{tableName:string;tableComment:string;score:number;matchedBy:ReadonlyArray<string>;matchedColumns:ReadonlyArray<Readonly<{name:string;comment:string}>>}>;
export function searchSchemaBundle(bundle:SchemaBundle,query:string,limit=10):ReadonlyArray<SchemaSearchMatch>{
  if(typeof query!=="string"||query.trim().length<1||query.length>500)throw new SchemaToolError("INVALID_SCHEMA_QUERY","스키마 검색어는 1~500자여야 합니다.",true);
  if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new SchemaToolError("INVALID_SCHEMA_QUERY","검색 결과 제한은 1~20이어야 합니다.",true);
  const tokens=queryTokens(query),relationships=bundle.relationships.relationships;
  return bundle.tables.map(document=>scoreDocument(document,tokens,relationships)).filter((item):item is SchemaSearchMatch=>item!==null).sort((a,b)=>b.score-a.score||a.tableName.localeCompare(b.tableName)).slice(0,limit);
}
function scoreDocument(document:TableSchemaDocument,tokens:ReadonlyArray<string>,relationships:SchemaBundle["relationships"]["relationships"]):SchemaSearchMatch|null{
  const table=document.table,matchedBy=new Set<string>(),matchedColumns=new Map<string,{name:string;comment:string}>();let raw=0;
  const tableName=compact(table.name),tableComment=compact(table.comment);
  for(const token of tokens){const value=compact(token);if(!value)continue;if(tableName===value){raw+=14;matchedBy.add("table_name_exact");}else if(tableName.includes(value)){raw+=10;matchedBy.add("table_name");}if(tableComment.includes(value)){raw+=7;matchedBy.add("table_comment");}
    for(const column of table.columns){const name=compact(column.name),comment=compact(column.comment);let hit=false;if(name===value){raw+=8;matchedBy.add("column_name_exact");hit=true;}else if(name.includes(value)){raw+=5;matchedBy.add("column_name");hit=true;}if(comment.includes(value)){raw+=4;matchedBy.add("column_comment");hit=true;}if(hit&&matchedColumns.size<10)matchedColumns.set(column.name,{name:column.name,comment:column.comment});}
    if(table.indexes.some(index=>compact(index.name).includes(value)||index.columns.some(column=>compact(column.name).includes(value)))){raw+=2;matchedBy.add("index");}
    if(relationships.some(relation=>(relation.sourceTable===table.name&&compact(relation.targetTable).includes(value))||(relation.targetTable===table.name&&compact(relation.sourceTable).includes(value)))){raw+=3;matchedBy.add("relationship_table");}
  }
  if(raw===0)return null;return {tableName:table.name,tableComment:table.comment,score:Number(Math.min(1,raw/Math.max(14,tokens.length*14)).toFixed(4)),matchedBy:[...matchedBy],matchedColumns:[...matchedColumns.values()]};
}
