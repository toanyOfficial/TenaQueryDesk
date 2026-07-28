import { access, mkdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { SchemaCurrentPointer } from "./types";
import { assertSafeConnectionKey, schemaVersionDirectoryName } from "./write-schema-files";

export async function publishCurrentSchema(
  pointer: SchemaCurrentPointer,
  root = path.join(process.cwd(), "schemas"),
): Promise<void> {
  assertSafeConnectionKey(pointer.connectionKey);
  const versionDirectory = schemaVersionDirectoryName(pointer.latestVersion);
  if (pointer.path !== `versions/${versionDirectory}` || !/^[0-9a-f]{64}$/.test(pointer.schemaHash)) {
    throw new Error("유효하지 않은 current 스키마 메타정보입니다.");
  }

  const connectionRoot = path.join(root, pointer.connectionKey);
  const versionRoot = path.join(connectionRoot, pointer.path);
  await access(path.join(versionRoot, "manifest.json"));
  const [resolvedRoot, resolvedVersion] = await Promise.all([
    realpath(root),
    realpath(versionRoot),
  ]);
  if (!resolvedVersion.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("허용되지 않은 스키마 경로입니다.");
  }
  await mkdir(connectionRoot, { recursive: true });
  const temporary = path.join(connectionRoot, `.current-${randomUUID()}.json`);
  const destination = path.join(connectionRoot, "current.json");
  await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

export function assertSafeSchemaRelativePath(connectionKey: string, filePath: string): void {
  assertSafeConnectionKey(connectionKey);
  const expected = `schemas/${connectionKey}/versions/`;
  if (path.isAbsolute(filePath) || !filePath.startsWith(expected)) {
    throw new Error("허용되지 않은 스키마 경로입니다.");
  }
  const suffix = filePath.slice(expected.length);
  if (!/^v\d{6}$/.test(suffix) || filePath.includes("..") || filePath.includes("\\")) {
    throw new Error("허용되지 않은 스키마 경로입니다.");
  }
}
