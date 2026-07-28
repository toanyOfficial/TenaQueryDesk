import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SchemaBundle, SchemaGenerationResult } from "./types";

const CONNECTION_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export function assertSafeConnectionKey(value: string): void {
  if (!CONNECTION_KEY.test(value)) throw new Error("안전하지 않은 connection key입니다.");
}
export function tableFileName(tableName: string): string {
  if (!tableName || /[\u0000-\u001f]/.test(tableName)) throw new Error("안전하지 않은 테이블명입니다.");
  return `t-${Buffer.from(tableName, "utf8").toString("hex")}.json`;
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export async function writeSchemaFiles(bundle: SchemaBundle, root = path.join(process.cwd(), "schemas")): Promise<SchemaGenerationResult> {
  const { manifest } = bundle;
  assertSafeConnectionKey(manifest.connectionKey);
  const temporaryRoot = path.join(root, ".tmp");
  const temporary = path.join(temporaryRoot, `${manifest.connectionKey}-${randomUUID()}`);
  const destination = path.join(root, manifest.connectionKey);
  const backup = path.join(temporaryRoot, `${manifest.connectionKey}-backup-${randomUUID()}`);
  let backedUp = false;
  try {
    await mkdir(path.join(temporary, "tables"), { recursive: true });
    const files = new Map(bundle.tables.map((document) => [document.table.name, document]));
    for (const entry of manifest.tables) {
      const document = files.get(entry.name);
      if (!document) throw new Error("manifest와 테이블 문서가 일치하지 않습니다.");
      const relative = `tables/${tableFileName(entry.name)}`;
      if (entry.file !== relative) throw new Error("manifest 파일 경로가 안전한 인코딩과 일치하지 않습니다.");
      await writeFile(path.join(temporary, relative), json(document), "utf8");
    }
    await writeFile(path.join(temporary, "manifest.json"), json(manifest), "utf8");
    await writeFile(path.join(temporary, "relationships.json"), json(bundle.relationships), "utf8");
    try { await rename(destination, backup); backedUp = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await rename(temporary, destination);
    if (backedUp) await rm(backup, { recursive: true, force: true });
    return { connectionId: manifest.connectionId, connectionKey: manifest.connectionKey, outputPath: `schemas/${manifest.connectionKey}`, generatedAt: manifest.generatedAt, tableCount: manifest.tableCount, viewCount: manifest.viewCount, fileCount: manifest.tables.length + 2 };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (backedUp) { await rm(destination, { recursive: true, force: true }); await rename(backup, destination); }
    throw error;
  }
}
