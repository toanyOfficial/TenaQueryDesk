const BLOCK=/(?:password|passwd|pwd|credential|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|secret)/i;
const MASK=/(?:email|e_mail|phone|mobile|tel|address|account[_-]?(?:no|number)|card[_-]?(?:no|number)|resident|ssn)/i;
export function sanitizeSqlRows(rows:ReadonlyArray<Record<string,unknown>>){
 const blockedColumns=new Set<string>(),maskedColumns=new Set<string>();
 const safe=rows.map(row=>Object.fromEntries(Object.entries(row).map(([name,value])=>{if(BLOCK.test(name)){blockedColumns.add(name);return [name,"[BLOCKED]"];}if(MASK.test(name)&&value!==null){maskedColumns.add(name);return [name,"[MASKED]"];}return [name,normalize(value)];})));
 return {rows:safe,blockedColumns:[...blockedColumns],maskedColumns:[...maskedColumns]};
}
function normalize(value:unknown):unknown {if(value===null||typeof value==="boolean"||typeof value==="number"||typeof value==="string")return value;if(typeof value==="bigint")return value.toString();if(value instanceof Date)return value.toISOString();if(Buffer.isBuffer(value))return `[binary ${value.byteLength} bytes]`;if(value&&typeof value==="object"&&"toString" in value)return String(value);return null;}
