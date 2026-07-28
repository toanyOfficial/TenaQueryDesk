import { createHash } from "node:crypto";

import type { SchemaBundle } from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "generatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

/** SHA-256 of structural schema data; volatile generatedAt fields are excluded. */
export function calculateSchemaHash(bundle: SchemaBundle): string {
  const tables = [...bundle.tables].sort((left, right) =>
    left.table.name.localeCompare(right.table.name),
  );
  const payload = canonicalize({
    manifest: {
      ...bundle.manifest,
      tables: [...bundle.manifest.tables].sort((left, right) => left.name.localeCompare(right.name)),
    },
    relationships: {
      ...bundle.relationships,
      relationships: [...bundle.relationships.relationships].sort((left, right) =>
        `${left.sourceTable}\0${left.constraintName}`.localeCompare(
          `${right.sourceTable}\0${right.constraintName}`,
        ),
      ),
    },
    tables,
  });
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}
