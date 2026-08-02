import {describe,expect,test} from "bun:test";
import {access} from "node:fs/promises";
import {API_CONTRACTS,API_CONTRACT_VERSION} from "@/lib/contracts/api-contracts";
describe("HTTP API contract manifest",()=>{test("keeps every declared route backed by a route module",async()=>{expect(API_CONTRACT_VERSION).toBe("v1");for(const contract of API_CONTRACTS){const relative=contract.path.replace(/^\/api\//,"").replace(/\[([^\]]+)\]/g,"[$1]");await access(new URL(`../../src/app/api/${relative}/route.ts`,import.meta.url));expect(contract.methods.length).toBeGreaterThan(0);if(contract.mutation)expect(contract.authenticated).toBe(true);}});});
