import "server-only";

import {
  readPort,
  requireBase64Bytes,
  requireMinimumLength,
  requireNonEmpty,
} from "@/lib/server/env-validation";

export type AuthEnvironment = Readonly<{
  passwordHash: string;
  sessionSecret: string;
}>;

export type OpenAIEnvironment = Readonly<{
  apiKey: string;
  model: string;
}>;

export type ManagementDbEnvironment = Readonly<{
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}>;

export type DbCredentialEncryptionEnvironment = Readonly<{
  key: Uint8Array<ArrayBuffer>;
}>;

export type QueryEnvironment = Readonly<{
  maxRows: number;
  timeoutMs: number;
  maxSqlLength: number;
}>;

/** Step 3에서 로그인과 세션 기능이 호출할 때 검증합니다. */
export function getAuthEnvironment(): AuthEnvironment {
  return Object.freeze({
    passwordHash: requireNonEmpty(process.env, "APP_PASSWORD_HASH"),
    sessionSecret: requireMinimumLength(process.env, "SESSION_SECRET", 32),
  });
}

/** Step 8에서 OpenAI 서버 호출을 수행할 때 검증합니다. */
export function getOpenAIEnvironment(): OpenAIEnvironment {
  return Object.freeze({
    apiKey: requireNonEmpty(process.env, "OPENAI_API_KEY"),
    model: requireNonEmpty(process.env, "OPENAI_MODEL"),
  });
}

/** 관리 DB 연결 풀이 최초로 필요할 때만 접속 설정을 검증합니다. */
export function getManagementDbEnvironment(): ManagementDbEnvironment {
  return Object.freeze({
    host: requireNonEmpty(process.env, "MANAGEMENT_DB_HOST"),
    port: readPort(process.env, "MANAGEMENT_DB_PORT", 3306),
    database: requireNonEmpty(process.env, "MANAGEMENT_DB_NAME"),
    user: requireNonEmpty(process.env, "MANAGEMENT_DB_USER"),
    password: requireNonEmpty(process.env, "MANAGEMENT_DB_PASSWORD"),
  });
}

/** Step 4에서 대상 DB 자격증명을 암복호화할 때 검증합니다. */
export function getDbCredentialEncryptionEnvironment(): DbCredentialEncryptionEnvironment {
  return Object.freeze({
    key: requireBase64Bytes(
      process.env,
      "DB_CREDENTIAL_ENCRYPTION_KEY",
      32,
    ),
  });
}

export function getQueryEnvironment(): QueryEnvironment {
  const maxRows = Number(process.env.QUERY_MAX_ROWS || "1000");
  const timeoutMs = Number(process.env.QUERY_TIMEOUT_MS || "10000");
  const maxSqlLength = Number(process.env.QUERY_MAX_SQL_LENGTH || "100000");
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 10000) throw new Error("QUERY_MAX_ROWS는 1~10,000 범위의 정수여야 합니다.");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) throw new Error("QUERY_TIMEOUT_MS는 1,000~120,000 범위의 정수여야 합니다.");
  if (!Number.isSafeInteger(maxSqlLength) || maxSqlLength < 1000 || maxSqlLength > 1000000) throw new Error("QUERY_MAX_SQL_LENGTH는 1,000~1,000,000 범위의 정수여야 합니다.");
  return Object.freeze({ maxRows, timeoutMs, maxSqlLength });
}
