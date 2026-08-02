import { redirect } from "next/navigation";

import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { getSession } from "@/lib/server/auth/session";
import {getFeatureFlags} from "@/lib/server/features/feature-flags";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await getSession())) redirect("/login");
  return <AnalysisWorkspace sqlExecutionEnabled={getFeatureFlags().sqlExecution}/>;
}
