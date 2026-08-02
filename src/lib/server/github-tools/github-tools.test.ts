import { describe, expect, test } from "bun:test";
import { assertTextContent, isExcludedPath, validateRef, validateRepositoryPath } from "./github-path-policy";
import { sanitizeSource } from "./github-result-sanitizer";
import { GitHubToolError } from "./github-tool-types";
import { createInitialToolRegistry } from "@/lib/server/agent/initial-tools";

describe("GitHub repository security policy", () => {
  test("allows repository-relative source paths and configured refs", () => {
    expect(validateRepositoryPath("src/app/page.tsx")).toBe("src/app/page.tsx");
    expect(validateRef("main", ["main", "work"])).toBe("main");
  });

  test.each(["../.env", "/etc/passwd", "https://example.com/file", ".env", "keys/private-key.pem", "backup.sql"])("blocks unsafe path %s", path => {
    expect(() => validateRepositoryPath(path)).toThrow(GitHubToolError);
  });

  test("blocks excluded, binary and unapproved ref inputs", () => {
    expect(isExcludedPath("node_modules/pkg/index.js")).toBe(true);
    expect(() => assertTextContent(Buffer.from([1, 0, 2]))).toThrow("binary");
    expect(() => validateRef("feature/unapproved", ["main"])).toThrow("허용된 branch");
  });

  test("masks credential-shaped source without changing ordinary code", () => {
    const content = 'const token = "github_pat_abcdefghijklmnopqrstuvwxyz123456";\nconst safe = "value";';
    const sanitized = sanitizeSource(content);
    expect(sanitized).not.toContain("github_pat_");
    expect(sanitized).toContain('const safe = "value"');
  });

  test("registers all eight read-only GitHub tools", () => {
    const registry=createInitialToolRegistry();
    for(const name of ["get_repository_context","list_repository_tree","search_repository_code","read_repository_file","find_repository_references","get_file_history","get_commit_details","compare_repository_refs"])expect(registry.get(name)).not.toBeNull();
  });
});
