# Server-only modules

후속 단계에서 관리 DB, 인증, OpenAI, 대상 DB 및 스키마 처리를 도메인별 하위 디렉터리로 분리합니다. 이 디렉터리의 모듈은 반드시 `server-only` 경계를 선언하고 Route Handler 또는 Server Component를 통해서만 사용합니다.
