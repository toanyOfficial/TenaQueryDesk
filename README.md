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
| `OPENAI_MODEL` | 서버에서 사용할 구조화 출력 지원 모델명 |
| `OPENAI_REQUEST_TIMEOUT_MS` | OpenAI 전체 요청 제한시간, 기본 60,000ms |
| `OPENAI_MAX_OUTPUT_TOKENS` | 구조화 응답 최대 출력 토큰, 기본 4,000 |
| `OPENAI_MAX_RETRIES` | 네트워크·429·5xx 제한 재시도, 기본 1회 |
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

관리자는 `/admin`에서 대상 MySQL의 접속정보를 등록합니다. 서비스는 자체 관리 테이블 `tq_db_connection`을 필요할 때 생성하고 비밀번호를 AES-256-GCM 암호문으로만 보관합니다. 등록 뒤 `스키마 파일 생성하기`를 실행하면 대상 DB의 `information_schema`를 읽어 서비스용 JSON 스키마 파일을 자동 생성하므로 사용자가 별도의 `schema.md`를 작성할 필요가 없습니다.

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

## PC 통합 분석 화면

로그인 후 기본 경로 `/`는 최소 너비 1200px의 PC 전용 분석 화면입니다. 64px 상단 도구 영역 아래에서 왼쪽 35%는 GPT 질문·답변, 오른쪽 65%는 SQL 편집기와 실행 결과를 43:57 높이로 동시에 표시합니다. 각 메시지·SQL·결과 영역은 전체 페이지 높이를 늘리지 않고 독립적으로 스크롤합니다.

화면은 인증된 API `/api/db-connections`에서 활성 DB의 ID·표시명만 조회하고 첫 항목을 기본 선택하도록 준비되어 있습니다. DB가 변경되면 다른 DB에서 작성한 쿼리를 실수로 사용하는 일을 막기 위해 질문, SQL, 결과와 오류 상태를 모두 초기화합니다. 선택한 DB의 최신 상태는 `/api/db-connections/{id}/schema/snapshots?limit=1` 연결 지점으로 분리했습니다. 현재 두 API는 선행 단계의 `schema.md` 부재로 구현되지 않았으므로 화면은 안전한 조회 실패 안내를 표시하며 접속정보를 대체 입력으로 요구하지 않습니다.

질문 입력은 `/api/analysis/generate`에 선택된 connection ID와 2~5,000자의 질문만 전송하도록 연결했습니다. 처리 중에는 중복 제출을 막고 답변·참조 테이블·가정·경고를 대화에 표시하며, 생성 SQL은 사용자 확인 후 편집기에 반영될 상태 구조를 갖습니다. 기존 SQL이 있으면 요청 전에 교체 확인을 요구하고, 구조 설명에서 SQL이 `null`이면 기존 SQL을 유지합니다. 쿼리 실행 버튼은 Step 10까지 비활성 상태입니다. 브라우저 저장소에는 선택 ID, 질문, SQL, 결과 또는 인증정보를 저장하지 않으며 DB host·username·password와 스키마 원문도 클라이언트 상태에 포함하지 않습니다.

GPT는 대상 DB에 접속하지 않고 최신 성공 스키마 파일만 사용합니다. 서버 탐색기는 manifest와 테이블별 JSON을 검증한 뒤 질문을 테이블명·코멘트·컬럼명·컬럼 코멘트와 비교하고, 직접 FK 관계를 1단계만 확장합니다. 최대 12개 테이블과 직렬화 100,000자로 제한하며 관련 구조를 찾지 못하면 전체 스키마를 대신 전송하지 않습니다. OpenAI 호출은 서버에서만 실행되고 30초 후 중단되며, 모델은 `OPENAI_MODEL` 한 곳에서 설정합니다. 구조화 응답의 참조 테이블이 선별 집합에 실제 존재하는지도 재검증합니다.

현재 저장소에는 `schema.md`, 활성 연결 repository 및 최신 성공 `schema_snapshot` 조회 함수 자체가 없습니다. 따라서 generate API는 인증과 입력 검증까지 수행한 뒤 `503`으로 안전하게 중단하며 OpenAI를 호출하지 않습니다. 이 선행 기능이 제공되면 `loadSchemaBundle()`과 `generateQueryFromSchema()`를 연결할 수 있습니다. Step 9에서는 준비된 모델명·질문·응답·처리시간 결과를 이력에 저장하고, Step 10에서는 생성 SQL에 별도의 SELECT 실행 안전 검증을 적용해야 합니다.

## GPT 질의 이력 기반

분석 화면은 현재 선택 DB의 최근 이력을 `/api/analysis/history?connectionId={id}&limit=20`에서 조회하는 드로어와 `/api/analysis/history/{id}` 상세 불러오기 흐름을 갖습니다. 목록은 질문 200자·답변 300자 수준의 미리보기, 요청 유형, 성공·실패, SQL 존재 여부와 생성 시각만 받는 계약이며 전체 LONGTEXT는 상세 요청에서만 받습니다. 성공 상세를 선택하면 질문과 답변을 대화에 복원하고 SQL이 있으면 교체 확인 후 편집기에 반영합니다. 실패 상세는 안전한 오류만 표시하고 SQL을 반영하지 않습니다.

워크스페이스는 `analysisHistoryId`를 별도 상태로 유지합니다. 새 GPT 결과나 과거 이력 불러오기 시 설정하고, 사용자가 SQL을 수정해도 출처 추적을 위해 유지하며, DB 변경 또는 SQL 초기화 시 제거합니다. 이를 Step 10의 실행 요청과 Step 11의 `query_execution_log` 연결에 사용할 예정입니다.

다만 루트 `schema.md`가 없어 `analysis_history`의 실제 컬럼·enum·인덱스·FK를 확인할 수 없으므로 repository SQL과 request type 매핑을 추측해 작성하지 않았습니다. 인증된 목록·상세 API는 파라미터 검증 후 현재 `503`을 반환합니다. 실제 구조가 제공되면 완료 후 단일 INSERT 정책으로 질문, 유형, 답변, SQL, 모델, 성공·실패와 안전한 오류만 저장하고 API 키, 접속정보, 시스템 프롬프트, 전체 스키마, 절대경로와 stack trace는 저장하지 않습니다. 이력 저장 자체가 실패해도 성공한 GPT 결과는 `analysisHistoryId: null`과 제한된 경고로 반환하는 비차단 정책을 적용해야 합니다. 삭제·수정·자동 정리 기능은 제공하지 않습니다.

## SELECT 실행 정책 기반

실행 API 경계는 `/api/query/execute`이며 브라우저에서는 `connectionId`, SQL, 선택적 `analysisHistoryId`만 전송합니다. SQL은 문자열·길이·제어문자 검사 후 문자열과 주석을 구분하는 syntax-aware lexer로 단일 statement를 확인하고 SELECT 또는 `WITH ... SELECT`만 허용합니다. CTE, JOIN, 서브쿼리와 UNION은 허용하되 DDL/DML, 다중 statement, 사용자 변수, `INTO OUTFILE`·`INTO DUMPFILE`, `LOAD_FILE`, `FOR UPDATE`, 잠금, 시스템 schema와 다른 DB prefix는 차단합니다. 이 lexer는 완전한 MySQL AST parser를 대신하지 않으므로 parser 의존성을 설치·검증하기 전에는 API가 실제 DB 실행으로 진행하지 않습니다.

서버 기본 제한은 최대 SQL 100,000자, 실행 10초, 반환 1,000행입니다. 최상위 LIMIT이 없으면 1,001행을 요청하고, 더 큰 LIMIT은 1,001로 줄인 뒤 실제 응답을 1,000행으로 잘라 정확한 `truncated` 상태를 계산합니다. BigInt는 문자열, 날짜는 ISO 문자열, Buffer는 크기 표시, null은 그대로 반환하며 단일 셀은 100,000자를 넘으면 축약합니다. 실행 모듈은 pool에서 단일 connection을 얻고 정상 완료 시 release하며 드라이버 timeout이면 해당 connection만 destroy하도록 준비했습니다. Step 11에는 사용자가 제출한 SQL과 서버가 실제 실행한 SQL을 구분하여 후자를 실행 이력에 우선 저장합니다.

현재 저장소에는 Step 4의 활성 대상 DB repository와 connection별 pool이 없으므로 실행 API는 인증과 입력·SELECT 정책 검증 후 `503`을 반환합니다. 실제 연결이 제공되면 반드시 `multipleStatements: false`, SELECT 및 metadata 최소 권한만 가진 읽기 전용 계정을 사용해야 합니다. INSERT·UPDATE·DELETE·DDL 권한을 부여하지 않고 가능하면 Read Replica나 분석 전용 DB를 사용해야 하며, 앱 검증을 DB 권한의 대체물로 간주하지 않습니다. GPT SQL은 편집기에만 반영되고 사용자가 실행 버튼 또는 F5를 명시적으로 눌러야 요청되며 자동 실행되지 않습니다.

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

## Step 11 실행 이력 정책과 현재 제한

SQL 실행 이력은 대상 DB에 **실제로 전달된 단일 SELECT**의 성공 또는 실패만 `query_execution_log`에 기록하는 정책입니다. 인증·입력·SQL 정책 검증 단계에서 차단된 요청은 실행 이력이 아닙니다. 저장 대상은 선택 DB 연결, 검증된 GPT 질의 이력 연결, 서버가 LIMIT을 적용한 실제 실행 SQL, 성공 여부, 행 수, 실행 시간, 정제된 오류와 생성 시각이며 결과 행·접속정보·비밀번호·stack trace는 저장하지 않습니다. 이력 저장 실패는 SQL 실행 결과를 실패로 바꾸지 않고 ID를 `null`로 반환하는 비차단 정책을 사용합니다.

목록은 현재 선택 DB 기준 최신 20건(최대 100건), SQL 300자 미리보기를 사용하고 전체 SQL은 상세 API에서만 조회하는 설계입니다. 과거 SQL을 편집기에 적용할 때 확인을 거치며 결과 행은 복구하거나 자동 재실행하지 않습니다. 삭제 기능은 제공하지 않으며, 연결된 `analysis_history_id`는 동일 connection일 때만 유지합니다.

현재 저장소에는 관리 DB 계약의 기준인 루트 `schema.md`와 Step 4 대상 DB repository/pool이 없습니다. 존재하지 않는 컬럼을 추측하거나 관리 DB를 변경하지 않기 위해 실제 `query_execution_log` INSERT/SELECT repository는 구현하지 않았습니다. `/api/query/history`와 상세 API는 인증 및 입력 검증 후 안전한 `503`을 반환하며, 실행 API도 대상 DB에 접속하지 않으므로 실행 이력을 생성하지 않습니다. 실제 테이블 정의와 대상 DB 모듈이 제공되면 이 계약에 맞춰 파라미터 바인딩 repository를 연결해야 합니다.

## Step 12 최소 관리 화면 및 MVP 준비 상태

인증된 `/admin` 경로는 분석 화면과 같은 세션·헤더를 사용하며 대상 DB 연결, 최신 스키마, 최근 GPT 실패, 최근 SQL 실행 실패를 서로 독립적으로 조회합니다. 한 영역이 실패해도 나머지 영역은 유지되고, 목록에는 접속정보·전체 스키마·전체 LONGTEXT를 넣지 않습니다. 스키마 노후도는 한곳의 상수로 7일 `갱신 권장`, 30일 `오래된 스키마`를 표시하며 자동 갱신이나 차단은 하지 않습니다. 수동 갱신은 확인과 connection별 중복 클릭 차단을 거치고, 실패 상세는 안전한 미리보기만 표시하며 SQL을 자동 실행하지 않습니다.

관리 화면에서 대상 DB 접속정보를 등록하고 연결 테스트를 수행한 뒤 `스키마 파일 생성하기`로 `information_schema` 기반 파일을 만들 수 있습니다. 대상 계정에는 분석 대상 DB의 SELECT와 metadata 조회에 필요한 최소 권한만 부여해야 합니다.

### Auto Deploy 등록 전 체크리스트

- runtime은 `nextjs_bun`, 서버 경로는 `/srv/{project_name}`, 포트는 배포 설정의 `PORT`를 사용합니다.
- 최초 clone 뒤 `appuser`로 `bun install --frozen-lockfile`을 실행하고 파일 소유자를 `appuser:appuser`로 맞춥니다.
- 서버에 직접 배치한 `.env`는 `appuser:appuser`, 권한 `600`으로 유지하며 Git에 추가하지 않습니다.
- `bun run build`와 `bun run start -H 0.0.0.0`을 배포 대상 Bun/Next 버전에서 검증합니다.
- `schemas/`와 임시 디렉터리는 `appuser` 쓰기 권한과 별도 백업 정책을 갖추며 생성물은 Git에 추가하지 않습니다.
- 관리 DB와 대상 DB 네트워크 접근을 확인하고 대상 DB 계정에는 SELECT 및 필요한 metadata 최소 권한만 부여합니다.
- `APP_PASSWORD_HASH`, `SESSION_SECRET`, 관리 DB 설정, `DB_CREDENTIAL_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` 및 쿼리 제한 설정을 서버 환경에 배치합니다.
- 운영 전 반드시 실제 `schema.md` 계약, 대상 DB CRUD/pool, 스키마 수집·snapshot repository, GPT 이력, 실행 이력과 관리 API를 연결하고 전체 흐름을 테스트합니다.

## Step 13 GPT 변경 SQL 안전 제안 정책

사이트 실행 API는 이전과 동일하게 서버에서 검증한 **단일 SELECT 계열만** 허용합니다. GPT가 제안하는 INSERT·UPDATE·DELETE·REPLACE·CREATE·ALTER·DROP·TRUNCATE 등은 `ddl_dml_reference` 참고 자료이며 자동 실행되지 않습니다. 편집기 역시 변경 SQL 출처를 표시하고 실행 버튼을 비활성화하지만, 최종 보안 경계는 프론트 표시가 아니라 서버 SELECT 검증입니다.

구조화 응답은 `riskLevel`(`read_only`, `data_change`, `schema_change`, `destructive`), 트랜잭션 안내와 실행 계획(사전 점검, 단계별 변경, 사후 검증, ROLLBACK 또는 복구)을 분리합니다. DML은 트랜잭션 지원 엔진의 같은 업무 단위에 한해 트랜잭션을 권고하며, 중간 오류가 자동 ROLLBACK되는 것은 아니므로 COMMIT하지 않고 같은 세션에서 ROLLBACK해야 합니다. 엔진, 외부 작업 또는 여러 DB 서버의 원자성은 가정하지 않습니다.

MySQL DDL은 암시적 COMMIT이 발생할 수 있어 여러 DDL이나 DDL·DML 혼합 작업의 전체 롤백을 보장하지 않습니다. DDL은 백업·의존성·잠금·데이터 호환성을 먼저 확인하고 한 단계씩 실행 및 검증하며, 역변경 SQL도 데이터 복원을 보장하지 않습니다. DROP, TRUNCATE, 컬럼 삭제, 타입 축소와 대량 삭제는 파괴적 변경으로 분류하고 별도 승인과 백업 복구를 요구합니다. 실제 운영 변경은 이 사이트 밖의 승인된 절차와 읽기/쓰기 권한이 분리된 도구에서 수행해야 합니다.

응답 validator는 위험도 allowlist, 변경 계획의 네 섹션, 파괴적 변경 경고, WHERE 없는 UPDATE/DELETE, COMMIT만 있고 ROLLBACK 안내가 없는 DML, DDL 전체 롤백을 보장하는 표현을 거부합니다. 안전 검증에 실패한 응답은 사용자에게 실행 절차로 노출하지 않으며 자동 보정 재호출도 하지 않습니다. 별도 `analysis_history` 컬럼을 추가하지 않고 기존 request type·답변·생성 SQL 저장 계약을 유지하되, 실제 매핑은 누락된 `schema.md`가 제공된 후 확인해야 합니다.

## Step 14 대상 DB read-only 권한 점검

애플리케이션의 SELECT-only 검증은 최종 방어선이 아닙니다. 대상 DB마다 기존 서비스나 관리자/root 계정과 분리된 분석 전용 계정을 사용하고, 가능하면 분석용 Read Replica를 우선하며 그다음 운영 DB의 전용 read-only 계정을 사용합니다. 기존 애플리케이션 계정 공유는 비권장입니다. 계정마다 별도 비밀번호를 사용하고 host는 분석 서버 IP 또는 제한된 내부 대역으로 제한하며 `'%'`, `GRANT OPTION`, `ALL PRIVILEGES`, 쓰기·DDL·관리 권한을 허용하지 않습니다.

권한 점검은 현재 연결 세션에서 읽기 전용인 `SELECT CURRENT_USER(), USER()`, `SHOW GRANTS FOR CURRENT_USER()`와 제한된 `information_schema` metadata 조회만 수행합니다. INSERT, UPDATE, DELETE, CREATE, DROP, GRANT 또는 REVOKE를 시험하지 않습니다. 대상 DB 전용 SELECT(필요 시 `SHOW VIEW`)만 있고 host가 제한되면 `safe`, 전역 SELECT나 과도한 scope는 `warning`, 쓰기·DDL·관리 권한은 `critical`, 파싱할 수 없거나 role 기반이면 `unknown`입니다. View 정의 권한 부족은 기본 read-only 판정과 별도의 스키마 수집 제한 경고로 표시합니다.

관리 화면의 `권한 점검`은 결과를 브라우저의 현재 페이지 상태에만 유지하며 DB 권한을 저장하거나 자동 변경하지 않습니다. 계정명은 마스킹하고 원본 GRANT, 비밀번호, 암호문과 connection string은 API 요약이나 일반 로그에 포함하지 않습니다. read-only가 아니어도 기존 SELECT 기능을 자동 중단하지 않지만 운영 전 수정이 필요한 위험 상태로 표시합니다. 현재 Step 4 대상 DB repository/pool이 없어 권한 API는 인증과 ID 검증 후 안전한 `503`을 반환하며 실제 점검은 fixture로만 검증했습니다.

DBA가 별도 승인 절차에서 적용할 수 있는 최소 권한 예시는 아래와 같습니다. 모든 값은 실제 값이 아닌 placeholder이며 이 사이트는 해당 SQL을 실행하지 않습니다.

```sql
CREATE USER 'ANALYSIS_ACCOUNT'@'ANALYSIS_SERVER_IP'
IDENTIFIED BY 'SEPARATE_STRONG_PASSWORD';
GRANT SELECT, SHOW VIEW ON `TARGET_DATABASE`.*
TO 'ANALYSIS_ACCOUNT'@'ANALYSIS_SERVER_IP';
SHOW GRANTS FOR 'ANALYSIS_ACCOUNT'@'ANALYSIS_SERVER_IP';
```

`SHOW VIEW`는 View 정의 수집이 실제로 필요한지 검증한 뒤에만 추가합니다. 일반 테이블·FK·index metadata는 해당 DB에 대한 최소 접근으로 확인하고, 부족한 metadata 권한은 스키마 수집 제한으로 별도 처리합니다. 실제 권한 생성·변경·회수는 DBA 또는 운영자가 수행해야 합니다.

## Step 15 OpenAI 운영 설정과 장애 격리

OpenAI 설정은 `src/lib/server/openai/config.ts`를 통해 실제 GPT 요청 시점에만 읽습니다. `OPENAI_API_KEY`와 `OPENAI_MODEL`은 필수이며 timeout은 5~180초, 출력은 500~16,000 token, 재시도는 0~2회로 제한됩니다. 기본값은 각각 60초, 4,000 token, 재시도 1회입니다. 모델 allowlist를 소스에 고정하지 않으므로 모델 교체는 서버 `.env`의 `OPENAI_MODEL`을 변경하고 프로세스를 재시작하여 적용합니다. 브라우저 요청은 모델, timeout, 출력 token과 재시도 횟수를 지정할 수 없습니다.

현재는 공식 SDK 의존성 없이 서버 `fetch`로 Chat Completions JSON Schema 응답을 요청합니다. 하나의 전체 deadline에 AbortController를 적용하며 네트워크 오류, 일반 429와 5xx만 짧은 backoff로 제한 재시도합니다. 인증·모델·quota·잘못된 요청·context 초과·safety refusal·응답 파싱 오류는 재시도하지 않고 안전한 code와 사용자 메시지로 변환합니다. context 초과 시 자동으로 schema를 반복 축소하거나 fallback 모델로 우회하지 않고 사용자에게 요청 범위를 줄이도록 안내합니다.

인증된 `/api/admin/openai/status`는 API 키의 존재 여부만 내부에서 확인하며 키 값이나 일부 문자를 반환하지 않습니다. 모델명, timeout, 출력 한도, 재시도 및 설정 issue만 표시합니다. 실제 연결 테스트는 비용과 rate limit을 발생시키므로 이번 단계에서는 추가하지 않았고 기존 실제 GPT 요청으로만 확인합니다. `analysis_history` repository가 아직 없어 최근 성공·실패는 `확인하지 못함`으로 표시합니다.

운영에서는 개인 임시 키를 공유하지 말고 개발·테스트·운영별 OpenAI 프로젝트 전용 키와 프로젝트 budget/usage limit을 사용해야 합니다. 키는 운영 서버의 권한 `600` `.env`에만 두고 Git, 브라우저와 로그에 기록하지 않습니다. 노출이 의심되면 즉시 폐기하고 재발급합니다. 전체 사용자 질문, 시스템 프롬프트, schema context, assistant 답변과 SQL도 일반 로그에 출력하지 않습니다. OpenAI 장애는 GPT 패널에만 영향을 주며 로그인, 관리, 권한 점검, 직접 SQL 작성과 SELECT 실행 경로를 초기화하거나 중단하지 않습니다.

## Step 16 Auto Deploy 런타임 운영

배포 runtime은 `nextjs_bun`입니다. `build`는 `next build`, `start`는 `next start`만 직접 실행하며 커스텀 HTTP 서버, 내부 `nohup`, 중첩 shell, background 실행, PM2/supervisor, 자체 재시작 또는 포트 종료 로직을 두지 않습니다. Auto Deploy가 외부에서 로그 리다이렉션과 background 실행을 담당하므로 프로젝트 서버는 foreground 프로세스로 동작합니다. 실제 포트는 코드 fallback이 아니라 Auto Deploy가 주입하는 `PORT`만 사용합니다.

```bash
bun run build
PORT=PROJECT_PORT bun run start -H 0.0.0.0
```

최초 clone에는 `node_modules`가 없으므로 Auto Deploy가 의존성을 별도로 설치하지 않는다면 빌드 전에 `bun install --frozen-lockfile`이 필요합니다. 다만 현재 저장소에는 Bun lock 파일이 없으므로 운영 등록 전에 신뢰 가능한 환경에서 lock 파일을 생성·검토·커밋해야 하며, 그 전에는 frozen 설치 명령이 성공한다고 간주할 수 없습니다. 설치를 `start` script에 넣지 않습니다.

### 공개 health와 읽기 전용 진단

`GET /api/health`는 인증 없이 로드밸런서가 사용할 수 있는 최소 응답으로 service, PID, uptime, `NODE_ENV`, 의도된 `PORT`만 반환합니다. build commit/time은 Step 17을 위한 `null` 자리만 제공합니다. 환경변수 목록, 부모 프로세스, 명령줄, 절대경로와 비밀정보는 반환하지 않습니다. 응답의 port는 설정 의도일 뿐 실제 LISTEN FD 소유를 증명하지 않습니다.

서버에서는 사람이 다음 읽기 전용 진단을 명시적으로 실행합니다. 스크립트는 프로세스를 종료·재시작하지 않고 `.env` 내용도 읽어 출력하지 않습니다.

```bash
cd /srv/PROJECT_NAME
bash scripts/verify-runtime.sh PROJECT_PORT

ps -eo pid,ppid,pgid,sid,user,stat,cmd \
  | grep -E 'auto_deploy|PROJECT_NAME|bun|node|php' \
  | grep -v grep
sudo lsof -iTCP:9090 -n -P
sudo lsof -iTCP:PROJECT_PORT -n -P
sudo ss -ltnp | grep -E ':9090|:PROJECT_PORT|php|bun|node'
git rev-parse --short HEAD
ls -la /srv/PROJECT_NAME
ls -ld /srv/PROJECT_NAME/schemas
ls -l /srv/PROJECT_NAME/.env
```

정상 상태에서는 9090을 Auto Deploy PHP만 소유하고, Tena Query Desk의 Bun/Node/Next 프로세스는 프로젝트 포트만 LISTEN하며, 같은 프로젝트 서버가 중복되지 않습니다. `/api/health`가 응답하고 `app.log` 최근 구간에 `EADDRINUSE`가 없어야 하며 `.env`가 존재하고 `schemas/`에 `appuser` 쓰기 권한이 있어야 합니다. Step 17 이후에는 health commit과 서버 Git HEAD도 일치해야 합니다.

프로젝트 프로세스가 프로젝트 포트와 9090을 함께 보유하거나, 불필요한 shell 계층·중복 서버·반복 `EADDRINUSE`가 보이면 비정상입니다. 프로젝트에 포트 기반 종료나 `/proc/self/fd` 일괄 close 우회를 추가하지 말고 정상 프로젝트와 Auto Deploy 자식 실행 방식을 비교해야 합니다. 9090 FD 상속은 부모 Auto Deploy 실행기가 자식 실행 전에 불필요한 FD를 닫지 않아 발생할 수 있으며 프로젝트 코드만으로 완전히 해결할 수 없습니다. Auto Deploy 저장소에서 self reboot를 포트 기준 종료가 아닌 전용 pidfile 기준으로 바꾸고, PHP 실행기가 자식에게 불필요한 LISTEN FD를 상속하지 않도록 별도로 수정해야 합니다.

### 런타임 파일 생존성과 권한

`.env`, `.env.local`, `schemas/` 생성물과 `app.log`는 Git에서 제외됩니다. 현재 `git reset --hard` 및 `.next` 삭제만으로는 비추적 파일이 일반적으로 유지되지만, 향후 `git clean` 추가나 서버 디스크 손실까지 보장하지 않으므로 `.env`의 안전한 별도 백업과 schema artifact 백업 정책이 필요합니다. 실제 서버 준비 예시는 다음과 같으며 비밀값 자체를 문서나 Git에 기록하지 않습니다.

```bash
sudo chown appuser:appuser /srv/PROJECT_NAME/.env
sudo chmod 600 /srv/PROJECT_NAME/.env
sudo mkdir -p /srv/PROJECT_NAME/schemas
sudo chown -R appuser:appuser /srv/PROJECT_NAME/schemas
```

`rm -rf .next`는 `schemas/`에 영향을 주지 않습니다. `app.log`는 Auto Deploy의 `> app.log 2>&1`가 관리하며 애플리케이션이 같은 파일을 별도로 열거나 자체 log rotation 프로세스를 실행하지 않습니다. 로그에는 API 키, DB 비밀번호, 세션 토큰, 전체 질문 또는 전체 SQL을 남기지 않습니다. 보존과 rotation은 서버 운영 영역에서 설정합니다.

## Step 17 배포 버전과 필수 파일 검증

`bun run build`는 먼저 Git 필수 파일을 검증하고 build metadata를 만든 다음 `next build`만 실행합니다. metadata는 외부 `BUILD_COMMIT_SHA`의 유효한 SHA를 가장 먼저 사용하고, 없으면 `git rev-parse HEAD`, 둘 다 사용할 수 없으면 `unknown`을 기록합니다. 빌드 시각은 UTC ISO 문자열이며 dirty는 untracked `.env`, `schemas/`, `app.log`가 아니라 tracked 및 staged diff만 판정합니다. 생성 파일 `src/generated/build-info.ts`는 Git에서 제외되고 Next build artifact에 포함됩니다.

```bash
bun run verify:files
bun run build:meta
bun run build
```

Git이 없는 source archive에서도 실제 파일 검증은 수행하되 index/HEAD 검증은 `skipped`로 표시합니다. 이때 외부 SHA가 없으면 health의 commit source는 `unknown`이며 운영 배포 완료 판정에 사용할 수 없습니다. build metadata 생성은 서버, DB, 스키마 또는 OpenAI에 연결하지 않습니다.

`GET /api/health`의 `build`는 short/full commit, build time, metadata source, tracked dirty 여부와 required-file manifest version을 반환합니다. 관리 화면의 **애플리케이션 런타임** 영역에는 short commit, 빌드 시각, uptime과 환경을 표시합니다. Git remote, credential, author/email, commit message, repository path는 API에 포함하지 않습니다.

### 필수 Git 파일과 런타임 파일 구분

`config/required-files.json`은 현재 저장소에 실제 존재하는 운영 핵심 소스·설정만 필수로 관리합니다. 검증기는 각 필수 경로에 대해 다음 세 상태를 독립적으로 확인하며 파일 내용은 출력하지 않습니다.

1. working tree에 일반 파일로 존재하는가
2. `git ls-files --error-unmatch`로 index에 추적되는가
3. `git cat-file -e HEAD:PATH`로 현재 commit에 포함되는가

working tree에만 있거나 staged만 된 파일은 배포 가능한 `HEAD`에 포함되지 않았으므로 실패합니다. 현재 저장소에 없는 `schema.md`와 Bun lock 파일은 manifest의 optional 경고로 명시했습니다. 운영 완성 전에는 두 파일의 필요성과 출처를 확인해야 하지만, 존재하지 않는 내용을 이번 단계에서 추측 생성하지 않았습니다. `.env`, `schemas/`, `.next/`, `node_modules/`, `app.log`는 Git 필수 파일이 아니며 `verify-runtime.sh` 또는 설치/build 단계에서 별도로 확인합니다.

### 서버 source와 실행 build 비교

```bash
cd /srv/PROJECT_NAME
git fetch --all
git rev-parse --short HEAD
git rev-parse --short TARGET_REF
git status --short
bun run verify:files
curl -s http://127.0.0.1:PROJECT_PORT/api/health
bash scripts/verify-runtime.sh PROJECT_PORT
```

health short commit과 `git rev-parse --short HEAD`가 같으면 현재 source tree로 빌드된 프로세스일 가능성이 높습니다. 다르면 이전 프로세스 잔존, 새 build 후 start 실패, HEAD만 변경됨, 다른 디렉터리·ref에서 실행, 다른 reverse proxy 대상, metadata fallback 등을 확인합니다. 포트 기준 kill을 추가하지 말고 health PID, LISTEN PID, Git HEAD와 `app.log`를 함께 대조합니다.

기대 commit과 실제 배포 ref의 관계는 다음 읽기 전용 명령으로 확인합니다. `TARGET_REF`는 무조건 `origin/main`이 아니라 실제 Auto Deploy 설정값이어야 합니다.

```bash
git log --oneline -10
git branch -a --contains EXPECTED_COMMIT
git merge-base --is-ancestor EXPECTED_COMMIT TARGET_REF
git ls-tree -r --name-only HEAD | grep 'FILE_PATH'
git show --stat --oneline EXPECTED_COMMIT
git show EXPECTED_COMMIT -- FILE_PATH
```

`branch --contains`에 target branch가 없거나 `merge-base --is-ancestor`가 실패하면 PR이 아직 merge되지 않았거나 다른 ref에만 있는 상태입니다. `ls-tree HEAD`에 안내된 script가 없으면 서버 reset 후에도 해당 파일이 생기지 않는 것이 정상이며 앱 설정 문제로 오판하지 않습니다. 로컬 commit과 PR 생성은 targetRef merge를 뜻하지 않으므로 merge 여부를 별도로 확인해야 합니다.

코드 작업 완료 보고에는 실제 commit SHA, 작업 branch, 변경 파일, `git status --short`, `git show --stat --oneline HEAD`, 중요 파일의 HEAD 포함 여부, PR 생성 여부를 포함해야 합니다. PR merge와 targetRef 포함 여부, 접근하지 못한 운영 서버 상태는 별도 확인 대상으로 명시합니다.

## Step 18 최종 운영 배포 판정

운영자가 순서대로 실행할 최종 준비 절차, 환경변수 대조표, 배포 중단 기준, 읽기 전용 E2E와 장애 점검표는 [`docs/operations/deployment-checklist.md`](docs/operations/deployment-checklist.md)에 정리했습니다. 현재 프로젝트는 루트 `schema.md`, Bun lock, 실제 관리/대상 DB repository와 E2E가 없고 핵심 API가 안전한 `503` placeholder이므로 **운영 불가**입니다. 문서의 필수 항목을 구현·검증하기 전에는 Auto Deploy에 활성 등록하거나 운영 완료로 보고하지 않습니다.
