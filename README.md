# Tena Query Desk

사내 실무자가 자연어 질문을 바탕으로 실제 DB 스키마에 맞는 SQL을 생성하고, 검토한 조회 쿼리의 결과를 한 화면에서 확인하기 위한 PC 전용 내부 웹 애플리케이션입니다.

현재 저장소는 **Step 3 공용 비밀번호 로그인 및 세션 인증**까지 포함합니다. OpenAI 연동, 스키마 수집 및 업무 DB SQL 실행은 아직 구현하지 않았습니다.

## 기술 스택

- Next.js App Router
- React
- TypeScript
- Bun
- Next.js Server Components 및 Route Handlers(후속 단계에서 사용)

## 로컬 실행

Bun을 설치한 뒤 저장소 루트에서 의존성을 설치하고 `.env.example`을 복사해 로컬 환경파일을 준비합니다.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

최초로 lock 파일을 만드는 경우에만 `bun install`을 사용합니다. `.env`와 `.env.local` 및 실제 비밀값은 절대 커밋하지 않습니다.

## 서버 환경변수

모든 값은 서버 전용이며 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.

| 이름 | 역할 |
| --- | --- |
| `APP_PASSWORD_HASH` | Step 3 공용 로그인에서 사용할 원문이 아닌 비밀번호 해시 |
| `SESSION_SECRET` | Step 3 세션 서명·검증에 사용할 32자 이상의 무작위 문자열 |
| `OPENAI_API_KEY` | Step 8 OpenAI 서버 호출용 API 키 |
| `MANAGEMENT_DB_HOST` | 관리 MySQL 호스트 |
| `MANAGEMENT_DB_PORT` | 관리 MySQL 포트, 미입력 시 `3306` |
| `MANAGEMENT_DB_NAME` | 관리 DB 이름 |
| `MANAGEMENT_DB_USER` | 관리 DB 사용자 |
| `MANAGEMENT_DB_PASSWORD` | 관리 DB 비밀번호 |
| `DB_CREDENTIAL_ENCRYPTION_KEY` | 대상 DB 자격증명 암복호화용 Base64 인코딩 32바이트 키 |

환경변수는 모듈 import 시 한꺼번에 검사하지 않고 로그인, 관리 DB, OpenAI, 암호화 기능이 실제 호출될 때 관련 그룹만 검사합니다. 따라서 비밀값이 없는 초기 빌드는 가능하지만, 필요한 런타임 값이 비어 있거나 잘못되면 값 자체를 노출하지 않는 명확한 오류로 실패합니다.

## 공용 로그인 및 세션

현재는 사용자별 계정 없이 하나의 공용 비밀번호를 사용합니다. 원문 비밀번호는 환경파일에도 저장하지 않고 Bun 내장 Argon2id 해시만 `APP_PASSWORD_HASH`에 저장합니다. 다음 예시는 비밀번호를 셸 기록에 남기지 않고 입력받아 해시를 출력합니다.

```bash
read -rsp "공용 비밀번호: " APP_PASSWORD; echo
APP_PASSWORD="$APP_PASSWORD" bun -e \
  'console.log(await Bun.password.hash(process.env.APP_PASSWORD!, "argon2id"))'
unset APP_PASSWORD
```

출력된 해시를 실제 서버 환경파일에 직접 설정하며 README나 Git에는 기록하지 않습니다. `SESSION_SECRET`에는 32자 이상의 충분히 긴 무작위 문자열을 설정합니다.

로그인 세션은 `authenticated`, `issuedAt`, `expiresAt`만 포함한 HMAC-SHA-256 서명 토큰이며 `tena_query_session` HttpOnly 쿠키에 12시간 동안 저장됩니다. 쿠키는 `SameSite=Lax`, `Path=/`이고 운영 환경에서는 `Secure`가 적용됩니다. 메인 화면의 **로그아웃** 버튼은 서버 Route Handler를 통해 쿠키를 즉시 만료합니다.

현재의 인증 모듈은 향후 사용자별 계정 및 권한 체계로 교체할 수 있도록 비밀번호 검증과 세션 처리를 분리했습니다. 로그인 API에는 프록시 신뢰 정책이 확정되지 않아 IP 기반 제한 대신 Argon2id 검증 비용과 실패당 500ms 지연을 적용했습니다. 다중 인스턴스 또는 외부 공개 전에 신뢰 가능한 프록시·공유 저장소 기반 rate limit을 추가해야 합니다.

## 대상 DB 자격증명 암호화

대상 DB 비밀번호는 관리 DB에 평문으로 저장하지 않고 AES-256-GCM으로 암호화합니다. `DB_CREDENTIAL_ENCRYPTION_KEY`에는 **정확히 32바이트인 키를 표준 Base64로 인코딩한 문자열**을 설정하며, 키는 암호문이 저장되는 관리 DB와 분리해 서버 환경파일에서만 관리합니다. 실제 키나 암호문을 문서와 로그에 기록하지 않습니다.

저장 포맷은 `v1:{iv}:{authTag}:{ciphertext}`이며 각 바이너리 부분은 Base64url로 인코딩합니다. 매 암호화마다 12바이트 무작위 IV를 새로 만들고 16바이트 인증 태그로 변조와 잘못된 키를 탐지합니다.

현재 저장소에는 관리 DB 구조 기준인 루트 `schema.md`가 제공되지 않았습니다. 따라서 `db_connection`의 실제 컬럼과 제약을 확인할 수 없어 repository, CRUD API, 대상 DB 풀 및 관리 UI는 의도적으로 구현하지 않았습니다. 문서가 제공되기 전에는 예상 컬럼을 SQL에 사용하거나 관리 DB 스키마를 추측하지 않습니다. 기존 데이터 및 암호문 포맷 호환성 역시 관리 DB 접속정보와 스키마 문서가 제공된 뒤 값 자체를 노출하지 않는 방식으로 확인해야 합니다.

## 스키마 파일 포맷 기반

MySQL 스키마 생성물은 운영 서버 로컬의 `schemas/{connection_key}` 아래 `manifest.json`, `relationships.json`, `tables/*.json`으로 저장하며 Git에는 포함하지 않습니다. 파일 작성기는 `schemas/.tmp`에서 모든 JSON을 먼저 작성한 뒤 기존 정상 디렉터리를 백업하고 교체하며, 실패하면 기존 디렉터리를 복원합니다. 테이블 파일명은 실제 이름의 UTF-8 바이트를 hex로 인코딩하여 경로 순회와 파일명 충돌을 방지합니다.

스키마 버전 파일은 `schemas/{connection_key}/versions/v000001` 형식으로 보존하고, 최신 성공 버전은 심볼릭 링크가 아닌 원자적으로 교체되는 `current.json` 메타파일이 가리킵니다. 구조 해시는 SHA-256이며 JSON 객체 키를 정렬하고 모든 `generatedAt` 필드를 제외한 canonical payload를 사용합니다. 따라서 생성 시각만 다른 동일 구조는 같은 해시가 됩니다. 동일 구조를 다시 생성해도 요청 이력을 보존하기 위해 버전은 증가하고 새 버전 디렉터리를 저장하는 정책입니다.

새 버전 파일 작성과 해시 계산이 성공한 뒤에만 `current.json`을 갱신하므로 실패한 결과가 최신 정상 버전을 덮어쓰지 않습니다. 실제 생성물은 계속 Git에서 제외됩니다. Auto Deploy의 현재 `git reset --hard` 흐름은 비추적 파일을 삭제하지 않지만 서버 디스크를 영구 백업으로 간주할 수 없으므로 운영 전 별도 백업 정책이 필요합니다. Step 8은 관리 DB의 최신 성공 snapshot과 실제 버전 디렉터리를 함께 검증한 후 사용해야 합니다.

스키마 JSON 타입, 결정적 해시, 버전 파일 작성 및 current 포인터 기반은 준비했지만, Step 4의 대상 DB repository와 풀은 `schema.md` 부재로 구현할 수 없었습니다. 실제 `information_schema` 수집기, 생성 API 및 관리 화면도 존재하지 않으며, `schema_snapshot`의 실제 컬럼과 상태 제약을 모르는 상태에서 SQL repository를 추측하여 추가하지 않습니다. `schema.md`가 제공되면 짧은 트랜잭션으로 `processing` 이력과 connection별 version을 할당하고, 파일 작업 밖에서 `success` 또는 `failed`로 갱신해야 합니다.

## 관리 DB 연결 확인

개발 서버를 실행한 뒤 다음 endpoint로 연결 풀과 `SELECT 1` 실행 여부만 확인할 수 있습니다.

```bash
curl -i http://localhost:3000/api/health/management-db
```

이 endpoint는 DB 호스트, 이름, 사용자, 비밀번호 또는 원본 드라이버 오류를 반환하지 않습니다. Auto Deploy 상태 확인을 위한 최소 공개 진단 API로 인증 검사에서 제외했으며, 운영 네트워크 외부에 서비스를 공개하기 전에는 접근 정책을 다시 검토해야 합니다. 루트 `schema.md`가 현재 저장소에 제공되지 않았으므로 추측한 테이블 검사는 수행하지 않습니다.

## 프로덕션 빌드 및 실행

```bash
bun run build
PORT=3800 bun run start -H 0.0.0.0
```

포트 `3800`은 로컬 예시일 뿐이며 코드에 고정되어 있지 않습니다. 운영 환경에서는 Auto Deploy가 `PORT`를 주입합니다. 빌드 산출물은 표준 `.next` 디렉터리에 생성되며 커스텀 서버, PM2, Docker 또는 런타임 마이그레이션을 전제로 하지 않습니다.

## Auto Deploy 전제

배포 타입은 `nextjs_bun`을 사용합니다. 저장소의 `build`와 `start` 스크립트는 다음 공통 흐름에 맞춰져 있습니다.

```bash
rm -rf .next
bun run build
nohup env PORT={port} bun run start -H 0.0.0.0 > app.log 2>&1 &
```

일반적인 신규 클론에는 `node_modules`가 없으므로 최초 빌드 전에 `bun install --frozen-lockfile`이 반드시 필요합니다. Auto Deploy 공통 흐름에 설치 단계가 없다면 서버 최초 설정 절차에서 `appuser`로 한 번 설치하거나, 공통 배포 흐름에 frozen lockfile 설치 단계를 추가해야 합니다.

## 관리 DB 스키마

관리 DB는 이미 생성되어 있으며 유일한 구조 기준은 저장소 루트의 `schema.md`입니다. 현재 저장소에는 해당 파일이 제공되지 않아 이번 단계에서는 테이블 CRUD나 존재 검사를 구현하지 않고 `SELECT 1` 연결 확인만 사용합니다. 후속 DB 기능을 시작하기 전에 파일을 제공하고 실제 테이블 및 컬럼을 확인해야 하며, 확인되지 않은 구조는 추측하여 구현하지 않습니다.

## 운영 환경파일

운영 `.env`는 Git이 아닌 서버의 프로젝트 디렉터리에 별도로 배치합니다. Auto Deploy의 `git reset --hard`가 추적되지 않는 `.env`를 삭제하지 않는 전제와 별개로, 배포 전 파일 존재 여부와 권한을 운영 절차에서 확인해야 합니다.

```bash
chown appuser:appuser .env
chmod 600 .env
```

위 명령은 운영 원칙 예시이며 저장소 작업 과정에서 실행하지 않습니다. 실제 비밀값은 README, 코드, Git 기록 또는 애플리케이션 로그에 기록하지 않습니다.

## 디렉터리 원칙

```text
src/
  app/            # App Router 화면, 레이아웃, 향후 Route Handler
  components/     # 재사용 가능한 클라이언트/표현 컴포넌트
  lib/server/     # DB, 인증, OpenAI, 스키마 등 서버 전용 모듈
  types/          # 공유 TypeScript 타입
```

`src/lib/server` 아래 모듈은 브라우저 컴포넌트에서 직접 가져오지 않습니다. 런타임 생성 스키마 파일은 기본적으로 Git 추적 대상에서 제외되며, 실제 영속 저장 경로와 운영 권한 정책은 스키마 기능 구현 전에 확정해야 합니다.
