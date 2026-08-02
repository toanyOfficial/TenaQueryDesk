import {describe,expect,test} from "bun:test";
import {readFile} from "node:fs/promises";
import {SECURITY_SEEDS,SECURITY_TABLES} from "@/lib/server/security/security-migration-manifest";
describe("management schema migration contract",()=>{test("is idempotent, non-destructive and preserves the bootstrap administrator",async()=>{const source=await readFile(new URL("../../src/lib/server/security/permission-repository.ts",import.meta.url),"utf8");for(const table of SECURITY_TABLES){expect(source).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);expect(source).not.toMatch(new RegExp(`DROP\\s+TABLE\\s+${table}`,"i"));}expect(source).toContain("INSERT IGNORE INTO tq_security_user");expect(source).toContain(SECURITY_SEEDS[0].userId);expect(source).toContain(SECURITY_SEEDS[0].role);});});
