import "server-only";

import {
  readPort,
  requireMinimumLength,
  requireNonEmpty,
} from "@/lib/server/env-validation";

export type AuthEnvironment = Readonly<{
  passwordHash: string;
  sessionSecret: string;
}>;

export type OpenAIEnvironment = Readonly<{
  apiKey: string;
}>;

export type ManagementDbEnvironment = Readonly<{
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}>;

export type DbCredentialEncryptionEnvironment = Readonly<{
  key: string;
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
    key: requireMinimumLength(
      process.env,
      "DB_CREDENTIAL_ENCRYPTION_KEY",
      32,
    ),
  });
}
