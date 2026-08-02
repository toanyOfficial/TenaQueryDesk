import {describe,expect,test} from "bun:test";
import {TEST_ERROR_CODES} from "@/lib/server/testing/test-types";
describe("quality report contract",()=>{test("defines stable operational failure categories",()=>expect(TEST_ERROR_CODES).toEqual(expect.arrayContaining(["TEST_ENVIRONMENT_NOT_READY","TEST_SECURITY_REGRESSION","TEST_MIGRATION_FAILED","TEST_SMOKE_FAILED","TEST_DEPLOYMENT_BLOCKED","TEST_FLAKY_DETECTED"])));});
