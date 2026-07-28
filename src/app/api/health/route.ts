import { NextResponse } from "next/server";

import { BUILD_INFO } from "@/generated/build-info";
import { getRuntimeInfo } from "@/lib/server/runtime-info";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "tena-query-desk",
      runtime: getRuntimeInfo(),
      build: {
        commit: BUILD_INFO.commitShort,
        fullCommit: BUILD_INFO.commitSha,
        buildTime: BUILD_INFO.buildTime,
        source: BUILD_INFO.source,
        dirty: BUILD_INFO.dirty,
        requiredFilesManifestVersion: BUILD_INFO.requiredFilesManifestVersion,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
