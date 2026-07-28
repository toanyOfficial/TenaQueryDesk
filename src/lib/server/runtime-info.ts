import "server-only";

import { parseRuntimePort } from "./runtime-values";

export type RuntimeInfo = Readonly<{
  nodeEnv: "development" | "production" | "test" | "unknown";
  pid: number;
  uptimeSeconds: number;
  port: number | null;
}>;

export function getRuntimeInfo(): RuntimeInfo {
  const environment = process.env.NODE_ENV;
  const nodeEnv = environment === "development" || environment === "production" || environment === "test"
    ? environment
    : "unknown";

  return {
    nodeEnv,
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    port: parseRuntimePort(process.env.PORT),
  };
}
