export type Environment = Readonly<Record<string, string | undefined>>;

export function requireNonEmpty(source: Environment, name: string): string {
  const value = source[name];

  if (!value?.trim()) {
    throw new Error(`필수 서버 환경변수 ${name}이(가) 설정되지 않았습니다.`);
  }

  return value;
}

export function requireMinimumLength(
  source: Environment,
  name: string,
  minimumLength: number,
): string {
  const value = requireNonEmpty(source, name);

  if (value.trim().length < minimumLength) {
    throw new Error(
      `서버 환경변수 ${name}은(는) 최소 ${minimumLength}자여야 합니다.`,
    );
  }

  return value;
}

export function readPort(
  source: Environment,
  name: string,
  defaultValue: number,
): number {
  const rawValue = source[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`서버 환경변수 ${name}은(는) 정수 포트여야 합니다.`);
  }

  const port = Number(rawValue);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`서버 환경변수 ${name}은(는) 1~65535 범위여야 합니다.`);
  }

  return port;
}

export function requireBase64Bytes(
  source: Environment,
  name: string,
  expectedBytes: number,
): Uint8Array<ArrayBuffer> {
  const value = requireNonEmpty(source, name);

  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`서버 환경변수 ${name}은(는) 올바른 Base64 형식이어야 합니다.`);
  }

  const decoded = Uint8Array.from(Buffer.from(value, "base64"));

  if (decoded.byteLength !== expectedBytes) {
    throw new Error(
      `서버 환경변수 ${name}은(는) Base64로 인코딩한 ${expectedBytes}바이트 값이어야 합니다.`,
    );
  }

  return decoded;
}
