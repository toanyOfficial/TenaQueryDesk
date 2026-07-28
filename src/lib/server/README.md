# Server-only modules

관리 DB, 인증, OpenAI, 대상 DB 및 스키마 처리를 도메인별 하위 디렉터리로 분리합니다. 이 디렉터리의 모듈은 반드시 `server-only` 경계를 선언하고 Route Handler 또는 Server Component를 통해서만 사용합니다.

- `env.ts`: 기능이 실제 호출되는 시점에 해당 서버 환경변수를 검증합니다.
- `db/management-db.ts`: MySQL 관리 DB 연결 풀과 최소 연결 확인 함수를 제공합니다.

서버 비밀값, 전체 연결 설정 또는 원본 DB 오류를 클라이언트 응답이나 로그에 포함하지 않습니다.
