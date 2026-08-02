import { lexSql, type SqlToken } from "@/lib/server/sql/sql-lexer";
import type { ParsedReadonlySql } from "./sql-tool-types";
const id=(t?:SqlToken)=>t&&(t.kind==="word"||t.kind==="quoted")?t.value:null;
const CLAUSES=new Set(["FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","CROSS","ON","GROUP","HAVING","ORDER","LIMIT","UNION","OFFSET"]);
const KEYWORDS=new Set(["SELECT","WITH","RECURSIVE","AS","DISTINCT","ALL","FROM","JOIN","LEFT","RIGHT","INNER","OUTER","CROSS","ON","WHERE","AND","OR","NOT","IS","NULL","IN","EXISTS","BETWEEN","LIKE","GROUP","BY","HAVING","ORDER","ASC","DESC","LIMIT","OFFSET","UNION","CASE","WHEN","THEN","ELSE","END","TRUE","FALSE"]);
export function parseReadonlySql(sql:string):ParsedReadonlySql {
 const tokens=lexSql(sql),sig=tokens.filter(t=>t.value!==";");
 const ctes=new Set<string>(); if(sig[0]?.upper==="WITH")for(let i=1;i<sig.length;i++)if((i===1||sig[i-1].value===",")&&id(sig[i])&&sig[i+1]?.upper==="AS")ctes.add(sig[i].upper);
 const tables:string[]=[],aliases=new Map<string,string>();
 for(let i=0;i<sig.length;i++)if(["FROM","JOIN"].includes(sig[i].upper)){
   const first=id(sig[i+1]); if(!first||sig[i+1].value==="(")continue; let table=first, qualifier:string|null=null, next=i+2;
   if(sig[next]?.value==="."){qualifier=first;table=id(sig[next+1])??"";next+=2;} if(!table)throw new Error("table");
   const qualified=qualifier?`${qualifier}.${table}`:table;if(!ctes.has(table.toUpperCase())){tables.push(qualified);aliases.set(table.toLowerCase(),qualified);const possible=id(sig[next]);if(possible&&sig[next]?.upper==="AS"){const alias=id(sig[next+1]);if(alias)aliases.set(alias.toLowerCase(),qualified);}else if(possible&&!CLAUSES.has(sig[next].upper))aliases.set(possible.toLowerCase(),qualified);}
 }
 const functions:string[]=[],columns:Array<{qualifier:string|null;name:string}>=[];
 for(let i=0;i<sig.length;i++){if(id(sig[i])&&sig[i+1]?.value==="(")functions.push(sig[i].upper);if(id(sig[i])&&sig[i+1]?.value==="."&&id(sig[i+2])){columns.push({qualifier:sig[i].value,name:sig[i+2].value});i+=2;continue;}if(id(sig[i])&&/^[A-Za-z_$\p{L}]/u.test(sig[i].value)&&!KEYWORDS.has(sig[i].upper)&&sig[i+1]?.value!=="("&&sig[i-1]?.value!=="."&&!["FROM","JOIN","AS","WITH","LIMIT","OFFSET","BY"].includes(sig[i-1]?.upper)&&!ctes.has(sig[i].upper)&&!aliases.has(sig[i].value.toLowerCase())&&!tables.some(t=>t.split(".").at(-1)?.toLowerCase()===sig[i].value.toLowerCase()))columns.push({qualifier:null,name:sig[i].value});}
 const limitIndex=sig.findIndex(t=>t.depth===0&&t.upper==="LIMIT"),limitToken=limitIndex>=0?sig[limitIndex+1]??null:null;let limit:number|null=null;if(limitToken&&/^\d+$/.test(limitToken.value))limit=Number(limitToken.value);
 const aggregates=new Set(["COUNT","SUM","AVG","MIN","MAX"]),aggregateOnly=functions.some(f=>aggregates.has(f))&&!sig.some(t=>t.depth===0&&t.upper==="GROUP");
 return {normalizedSql:sql.trim().replace(/;\s*$/, ""),tokens,tables:[...new Set(tables)],aliases,columns,functions:[...new Set(functions)],joinCount:sig.filter(t=>t.upper==="JOIN").length,subqueryDepth:Math.max(0,...sig.filter(t=>t.upper==="SELECT").map(t=>t.depth)),limit,limitToken,aggregateOnly};
}
