import "server-only";

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

import { getManagementDbEnvironment } from "@/lib/server/env";

const DEVELOPMENT_POOL_KEY = "__tenaQueryDeskManagementDbPool" as const;

type DevelopmentGlobal = typeof globalThis & {
  [DEVELOPMENT_POOL_KEY]?: Pool;
};

const developmentGlobal = globalThis as DevelopmentGlobal;
let productionPool: Pool | undefined;

export class ManagementDbConnectionError extends Error {
  constructor() {
    super("관리 DB 연결에 실패했습니다.");
    this.name = "ManagementDbConnectionError";
  }
}

function createManagementDbPool(): Pool {
  const environment = getManagementDbEnvironment();

  return mysql.createPool({
    host: environment.host,
    port: environment.port,
    database: environment.database,
    user: environment.user,
    password: environment.password,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false,
  });
}

export function getManagementDbPool(): Pool {
  if (process.env.NODE_ENV === "development") {
    developmentGlobal[DEVELOPMENT_POOL_KEY] ??= createManagementDbPool();
    return developmentGlobal[DEVELOPMENT_POOL_KEY];
  }

  productionPool ??= createManagementDbPool();
  return productionPool;
}

export async function checkManagementDbConnection(): Promise<void> {
  try {
    const pool = getManagementDbPool();
    await pool.execute<RowDataPacket[]>("SELECT 1 AS ok");
  } catch {
    // 원본 드라이버 오류에는 접속정보가 포함될 수 있어 외부로 전달하지 않습니다.
    throw new ManagementDbConnectionError();
  }
}
