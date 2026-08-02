export function sanitizeRuntimeText(value:string,maxCharacters=8_000):{text:string;truncated:boolean}{
 let safe=value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
 safe=safe.replace(/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/g,"[REDACTED TOKEN]");
 safe=safe.replace(/((?:password|passwd|token|secret|api[_-]?key|authorization|database_url)\s*[:=]\s*["']?)[^\s,"'}]+/gi,"$1[REDACTED]");
 safe=safe.replace(/(?:mysql|postgres(?:ql)?):\/\/[^\s]+/gi,"[REDACTED CONNECTION]");
 safe=safe.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,"[REDACTED PRIVATE KEY]");
 const truncated=safe.length>maxCharacters;return{text:truncated?safe.slice(0,maxCharacters):safe,truncated};
}
