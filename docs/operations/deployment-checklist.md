# Tena Query Desk 운영 배포 체크리스트

이 문서는 운영자가 위에서 아래 순서로 점검하기 위한 **준비 문서**다. 실제 서버 배포, Auto Deploy 등록, DB 변경, 사용자·권한 생성은 이 저장소 작업 범위에 포함되지 않는다. 현재 저장소는 핵심 repository/API가 안전한 `503` placeholder인 scaffold이므로 아래의 **배포 중단 항목**을 해소하기 전에는 운영 완료로 판정하지 않는다.

## 0. 현재 판정: 운영 불가

다음 필수 선행조건이 현재 저장소에서 확인되지 않았다.

- 루트 `schema.md`와 관리 DB 초기화 SQL/migration이 없다.
- 대상 DB 연결 CRUD/repository/pool 및 실제 연결 테스트 API가 없다.
- `information_schema` 수집기와 schema snapshot repository/API가 없다.
- GPT 생성 API가 최신 성공 schema를 조회하지 못해 `503`을 반환한다.
- GPT 및 SQL 실행 이력 repository/API가 `503` placeholder다.
- SELECT 실행 API가 대상 DB pool과 연결되지 않아 `503`을 반환한다.
- Bun lock 파일과 설치된 `node_modules`가 없어 전체 lint/typecheck/build/start를 완료하지 못했다.
- 실제 관리 DB, 대상 DB, OpenAI, Auto Deploy 및 reverse proxy 환경의 E2E 결과가 없다.

SELECT validator, credential codec, schema file/version primitives, OpenAI client 정책, grant parser, build provenance, health 및 운영 진단은 준비되어 있으나 이것만으로 운영 MVP가 완성된 것은 아니다.

## 1. Auto Deploy 등록정보 확정

| 항목 | 확정/추천 | 상태 |
| --- | --- | --- |
| `project_key` | 추천 `tena_query_desk` | 중복 여부 확인 필요 |
| `display_name` | `Tena Query Desk` | 추천값 |
| `server_path` | 추천 `/srv/tena-query-desk` | 실제 정책 확인 필요 |
| `port` | `PROJECT_PORT` | 서버 LISTEN 현황 확인 필요 |
| `runtime_type` | `nextjs_bun` | 확정 |
| `targetRef` | `TARGET_REF` | 실제 branch/ref 확인 필요 |
| `enabled` | 필수조건 완료 후 활성화 | 확인 필요 |
| `stable_ref` | 운영자가 승인한 commit/ref | 확인 필요 |
| log | `/srv/PROJECT_NAME/app.log` | 경로 확정 후 적용 |
| health | `/api/health` | 확정 |

`project_key`는 Auto Deploy의 실제 규칙과 기존 프로젝트 목록에서 중복을 확인한다. 포트는 추측하지 않고 등록 전에 확인한다.

```bash
sudo ss -ltnp
sudo ss -ltnp | grep ':PROJECT_PORT'
```

후자의 출력이 없을 때 후보 포트가 비어 있다. 사용 중이면 다른 프로세스를 광범위하게 종료하지 말고 등록 포트나 기존 프로젝트 관계를 확인한다.

## 2. 서버 디렉터리와 clone 준비

다음 변경 명령은 운영 승인 후 서버 관리자가 실행한다.

```bash
sudo mkdir -p /srv/PROJECT_NAME
sudo chown appuser:appuser /srv/PROJECT_NAME
sudo -u appuser -H git clone REPOSITORY_URL /srv/PROJECT_NAME
```

Auto Deploy가 빈 경로 clone을 지원하는지, 이미 clone된 경로만 배포하는지는 확인하지 못했다. 실제 deploy key/credential 정책을 사용하고 URL 또는 credential을 이 문서에 기록하지 않는다.

```bash
ls -ld /srv/PROJECT_NAME
find /srv/PROJECT_NAME -maxdepth 2 \( ! -user appuser -o ! -group appuser \) -print
```

프로젝트 파일의 소유권은 `appuser:appuser`가 원칙이다. 필요 시 프로젝트 경로만 대상으로 소유권을 보정하며 시스템 파일, deploy key와 외부 credential까지 일괄 변경하지 않는다.

## 3. commit과 필수 파일 확인

```bash
cd /srv/PROJECT_NAME
git fetch --all
git rev-parse --short HEAD
git rev-parse --short TARGET_REF
git status --short
git branch -a --contains EXPECTED_COMMIT
git merge-base --is-ancestor EXPECTED_COMMIT TARGET_REF
git show --stat --oneline EXPECTED_COMMIT
bun run verify:files
```

`HEAD`, `TARGET_REF`, `EXPECTED_COMMIT` 관계가 일치해야 한다. PR 생성은 merge를 의미하지 않는다. `verify:files`는 working tree, index와 `HEAD`를 구분한다. `.env`, `schemas/`, `.next`, `node_modules`, `app.log`는 Git 필수 파일이 아니라 runtime 준비 대상이다.

현재 `schema.md`와 `bun.lock`/`bun.lockb`는 optional warning으로 보고된다. 출처를 확인하지 않은 내용을 임의 생성하지 말고, 운영 계약과 dependency resolution을 검토한 뒤 추가한다.

## 4. 의존성 설치

`package.json`은 Bun `1.2.14`를 선언한다. 운영 Bun 버전 호환성을 먼저 확인한다.

```bash
sudo -u appuser -H bash -lc 'cd /srv/PROJECT_NAME && bun --version'
sudo -u appuser -H bash -lc 'cd /srv/PROJECT_NAME && bun install --frozen-lockfile'
```

현재 lock 파일이 없으므로 두 번째 명령은 **지금 실행 가능한 절차가 아니다**. 신뢰 가능한 환경에서 lock을 생성·검토·커밋하고 `package.json`과의 일치를 확인한 뒤 사용한다. Auto Deploy 공통 흐름에 install이 없다면 다음 중 하나를 운영 정책으로 확정한다.

1. 권장: Auto Deploy `nextjs_bun` build 전에 `bun install --frozen-lockfile` 수행.
2. 대안: package/lock 변경 배포 전에 운영자가 appuser로 수동 설치.

install을 프로젝트의 `build` 또는 `start` script에 넣지 않는다.

## 5. 운영 `.env` 준비

`.env.example`을 템플릿으로 서버에만 배치한다. 값을 출력하는 점검 명령은 사용하지 않는다.

| 변수 | 코드 사용 | 필수/기본값 | 검증 시점 | 비밀 |
| --- | --- | --- | --- | --- |
| `APP_PASSWORD_HASH` | 예 | 로그인 필수 | 로그인 요청 | 예 |
| `SESSION_SECRET` | 예 | 32자 이상, 로그인 필수 | 로그인/세션 | 예 |
| `OPENAI_API_KEY` | 예 | GPT 필수 | GPT 요청/상태 진단 | 예 |
| `OPENAI_MODEL` | 예 | GPT 필수 | GPT 요청/상태 진단 | 아니오 |
| `OPENAI_REQUEST_TIMEOUT_MS` | 예 | 기본 60000, 5000~180000 | GPT 요청 | 아니오 |
| `OPENAI_MAX_OUTPUT_TOKENS` | 예 | 기본 4000, 500~16000 | GPT 요청 | 아니오 |
| `OPENAI_MAX_RETRIES` | 예 | 기본 1, 0~2 | GPT 요청 | 아니오 |
| `MANAGEMENT_DB_HOST` | 예 | 관리 DB 필수 | pool 최초 사용 | 예 |
| `MANAGEMENT_DB_PORT` | 예 | 기본 3306 | pool 최초 사용 | 아니오 |
| `MANAGEMENT_DB_NAME` | 예 | 관리 DB 필수 | pool 최초 사용 | 예 |
| `MANAGEMENT_DB_USER` | 예 | 관리 DB 필수 | pool 최초 사용 | 예 |
| `MANAGEMENT_DB_PASSWORD` | 예 | 관리 DB 필수 | pool 최초 사용 | 예 |
| `DB_CREDENTIAL_ENCRYPTION_KEY` | 예 | Base64 인코딩된 정확히 32 bytes | 암복호화 시 | 예 |
| `QUERY_MAX_ROWS` | 예 | 기본 1000, 1~10000 | query 정책 사용 시 | 아니오 |
| `QUERY_TIMEOUT_MS` | 예 | 기본 10000, 1000~120000 | query 정책 사용 시 | 아니오 |
| `QUERY_MAX_SQL_LENGTH` | 예 | 기본 100000, 1000~1000000 | query 정책 사용 시 | 아니오 |

코드에서 사용하는 운영 변수와 `.env.example` 이름은 일치하며 `OPEN_API_KEY` 또는 `NEXT_PUBLIC_*` 비밀 변수는 없다. `BUILD_COMMIT_SHA`, `BUILD_INFO_OUTPUT`, `REQUIRED_FILES_MANIFEST`, `PORT`, `NODE_ENV`는 build/진단/runtime 제어값이며 운영 비밀 템플릿 대상과 구분한다.

```bash
sudo chown appuser:appuser /srv/PROJECT_NAME/.env
sudo chmod 600 /srv/PROJECT_NAME/.env
ls -l /srv/PROJECT_NAME/.env
```

### secret 수명주기

- `APP_PASSWORD_HASH`: Bun Argon2id 검증용 독립 해시다. 저장소에는 운영용 hash generator가 없으므로 검증된 stdin/prompt 기반 생성 절차를 운영 전에 마련해야 한다. 평문을 명령행 인자로 전달하지 않는다.
- `SESSION_SECRET`: 다른 secret과 분리한다. 변경하면 기존 세션이 무효화될 수 있다.
- `DB_CREDENTIAL_ENCRYPTION_KEY`: 다른 secret과 분리하고 안전하게 백업한다. 회전 기능이 없으므로 임의 변경 시 기존 대상 DB credential 복호화가 실패할 수 있다.
- `OPENAI_API_KEY`: 프로젝트 전용 키를 사용한다. 노출 시 폐기·재발급하며 기존 관리 DB 암호문과는 무관하다.

## 6. `schemas/`와 runtime 파일

```bash
sudo mkdir -p /srv/PROJECT_NAME/schemas
sudo chown -R appuser:appuser /srv/PROJECT_NAME/schemas
ls -ld /srv/PROJECT_NAME/schemas
sudo -u appuser -H test -w /srv/PROJECT_NAME/schemas
```

`schemas/`는 `.next` 삭제 및 Git reset과 분리되지만 서버 디스크 손실에는 안전하지 않다. 용량, 백업과 오래된 파일 정리 정책은 아직 구현되지 않았다. `app.log`는 Auto Deploy가 생성하며 rotation/보존은 서버 운영 영역이다. `.next`는 build 산출물이고 `node_modules`는 dependency install 결과다.

백업 대상은 관리 DB, 안전한 비밀 저장소의 `.env`, `schemas/`, Auto Deploy 설정이다. Git source는 remote에서 복구할 수 있다. `DB_CREDENTIAL_ENCRYPTION_KEY` 손실은 기존 암호문의 복호화 실패로 이어질 수 있다.

## 7. 관리 DB 준비 — 현재 배포 차단

관리 DB의 유일한 계약이어야 할 루트 `schema.md`, 초기 SQL 및 migration이 현재 없다. 따라서 `db_connection`, `schema_snapshot`, `analysis_history`, `query_execution_log` 등의 실제 이름·컬럼·제약을 확인할 수 없으며 초기화 방법도 없다. 운영 전에 다음을 완료한다.

1. 승인된 `schema.md`와 초기화/migration 절차 제공.
2. 실제 관리 DB schema와 코드 repository 계약 대조.
3. 관리 DB 계정에 앱 기록에 필요한 최소 read/write 권한 부여.
4. charset/collation, FK, timezone 정책 확인.
5. `GET /api/health/management-db`로 연결 확인 후 실제 repository 통합 테스트.

관리 DB 계정은 앱 자체 데이터를 기록하므로 target DB read-only 계정과 다르다. 이번 문서대로 실제 migration이나 임의 SQL을 실행하지 않는다.

## 8. 대상 DB read-only 준비 — 현재 배포 차단

각 대상 DB 또는 서버마다 분석 전용 계정을 사용한다. root, 기존 서비스 계정, `ALL PRIVILEGES`, `GRANT OPTION`, 쓰기·DDL·관리 권한과 광범위 `%` host를 사용하지 않는다. 권장 최소 방향은 대상 database의 `SELECT`와 실제 schema 수집에 필요한 metadata/`SHOW VIEW` 범위이며, 분석 서버 IP로 host를 제한한다. 가능하면 Read Replica를 우선한다.

사이트 등록 후 순서는 연결 테스트 → 권한 점검 → schema 생성 → 최신 성공 schema 확인 → 작은 SELECT다. 현재 연결 CRUD/repository/pool과 collection API가 없으므로 이 순서는 실행할 수 없으며 운영 전에 구현해야 한다. 쓰기 SQL로 권한을 시험하지 않는다.

## 9. OpenAI 준비

`OPENAI_API_KEY`, `OPENAI_MODEL`, timeout, output token과 retry 설정을 확인하고 `/api/admin/openai/status`에서 키 값 없이 상태를 확인한다. 실제 키가 준비된 후 SELECT 질문 1건, 안전한 실패 및 이력 저장을 검증한다. 프로젝트 budget/usage limit을 설정한다.

OpenAI 장애는 로그인, 관리, 직접 SQL 작성 및 SELECT 경로 전체를 중단시키지 않아야 한다. 다만 현재 schema repository와 analysis history가 없어 실제 GPT 요청 경로는 `503`이며 운영 검증이 불가능하다.

## 10. build와 foreground start

```bash
cd /srv/PROJECT_NAME
git status --short
git rev-parse --short HEAD
bun run verify:files
bun run lint
bun run typecheck
bun run build
test -d .next
test -f package.json
```

Auto Deploy 최소 필수는 `verify:files`와 `build`다. lint/typecheck는 release gate 또는 CI에서 수행한다. build는 metadata와 Next artifact만 만들며 서버, migration, 대상 DB, OpenAI를 실행하지 않는다.

Auto Deploy 등록 전 foreground 검증은 appuser로 수행한다.

```bash
sudo -u appuser -H bash -lc 'cd /srv/PROJECT_NAME && PORT=PROJECT_PORT bun run start -H 0.0.0.0'
curl -i http://127.0.0.1:PROJECT_PORT/api/health
```

확인 후 해당 터미널/session의 foreground 프로세스만 정상 종료한다. 포트 기준 광범위 kill은 사용하지 않는다.

## 11. Auto Deploy 최초 배포 후 검증

```bash
cd /srv/PROJECT_NAME
git rev-parse --short HEAD
curl -s http://127.0.0.1:PROJECT_PORT/api/health
sudo lsof -iTCP:PROJECT_PORT -n -P
sudo lsof -iTCP:9090 -n -P
ps -eo pid,ppid,pgid,sid,user,stat,cmd | grep -E 'auto_deploy|PROJECT_NAME|bun|node|php' | grep -v grep
tail -n 100 /srv/PROJECT_NAME/app.log
bash scripts/verify-runtime.sh PROJECT_PORT
```

정상 기준은 project port LISTEN, health 200, health commit=server HEAD, 최근 `EADDRINUSE` 없음, 중복 server 없음, 9090은 Auto Deploy PHP만 소유하는 상태다. 프로젝트가 9090을 보유하거나 commit이 다르면 완료 처리하지 않는다.

Auto Deploy self reboot는 별도 승인된 시험에서 프로젝트 PID/health를 전후 비교한다. Auto Deploy만 재시작되고 프로젝트 health와 port가 유지되어야 한다. 부모 FD close와 pidfile 처리는 Auto Deploy 저장소 책임이며 이 프로젝트만으로 성공을 보장하지 않는다.

## 12. 읽기 전용 E2E 체크리스트

실제 관리 DB, target DB, OpenAI와 모든 API repository가 준비된 뒤에만 수행한다.

1. 올바른/잘못된 공용 비밀번호, session 유지, logout, 미인증 API를 확인한다.
2. 관리 화면의 health/build/OpenAI/DB/schema/최근 실패 영역을 확인한다.
3. target DB 등록 후 비밀번호가 다시 노출되지 않는지 확인한다.
4. 연결 및 read-only 권한을 점검한다.
5. schema를 수동 생성하고 version/hash/current, 실패 시 이전 성공 유지 여부를 확인한다.
6. 자연어 SELECT 질문으로 schema 선택, SQL/설명 생성과 analysis history를 확인한다.
7. 명시적으로 SELECT를 실행해 result, row limit, timeout과 execution history를 확인한다.
8. UPDATE/ALTER 질문은 참고용 위험도·transaction/implicit commit 경고만 표시되고 UI 및 직접 API 모두 실행을 차단하는지 확인한다.
9. 과거 GPT/SQL과 실패 상세를 불러오되 자동 재실행되지 않는지 확인한다.

운영 target DB에서 허용하는 검증은 SELECT와 metadata 조회뿐이다. INSERT, UPDATE, DELETE, DDL, 임시 테이블 및 쓰기 권한 시험을 금지한다. 관리 DB에 생긴 테스트 기록의 유지/수동 정리 정책은 실제 `schema.md`를 기준으로 별도 승인하며 자동 삭제하지 않는다.

## 13. 세션, 네트워크와 시간

- production cookie는 HttpOnly, SameSite=Lax, Secure이며 12시간 세션이다. HTTPS reverse proxy에서 로그인/cookie를 확인한다. 내부 HTTP에서 Secure cookie 문제가 생겨도 보안을 낮추기보다 HTTPS를 우선한다.
- 사용자별 계정·권한이 없고 공용 비밀번호만 사용하므로 인터넷 전체 공개는 금지에 가깝게 취급한다. 사내망/VPN, proxy allowlist, 방화벽 순으로 제한한다.
- domain, HTTPS, proxy timeout/body limit과 health route 설정은 운영자가 확정한다. 이 문서는 Caddy/방화벽을 변경하지 않는다.
- build time은 UTC ISO다. UI는 브라우저 locale로 표시한다. 관리/target DB timestamp, 서버와 DB timezone, Asia/Seoul 업무 날짜 경계는 실제 E2E에서 확인해야 하며 DB timezone을 임의 변경하지 않는다.

## 14. 배포 중단 조건

다음 중 하나라도 발생하면 운영 배포 완료로 처리하지 않는다.

- required file 검증, lint/typecheck release gate 또는 build 실패
- lock 파일/의존성 준비 불가, `.env` 누락·형식 오류
- 관리 DB 연결 또는 schema 계약 실패
- auth hash/SESSION_SECRET/credential key 설정 오류
- `schemas/` 쓰기 실패
- health 실패, build commit과 server HEAD 불일치, port 충돌
- 프로젝트의 9090 FD 상속 또는 중복 process
- target DB root/ALL PRIVILEGES 사용 또는 승인되지 않은 warning
- target DB password, OpenAI key 등 민감정보 노출
- SELECT 외 SQL 실행 가능 또는 미인증 protected API 접근 가능

OpenAI만 미설정인 경우에도 현재 scaffold에서는 target DB/SELECT 기능 자체가 연결되지 않았으므로 제한 운영할 수 없다. 향후 나머지 기능이 완성된 뒤에는 GPT 비활성·직접 SELECT 한정 운영을 별도 승인할 수 있다.

## 15. 장애 첫 점검표

| 증상 | 최초 확인 |
| --- | --- |
| 사이트 접속 불가 | project LISTEN, Auto Deploy 결과, health, `app.log`, proxy, 방화벽 |
| 로그인 불가 | hash 형식, SESSION_SECRET, Secure cookie/HTTPS, 서버 시간 |
| 관리 DB 오류 | `.env` 존재·권한, 네트워크, DB 권한, schema 계약/pool |
| target DB 오류 | host/port/database/user credential, IP/TLS, host pattern, 활성 상태 |
| 권한 warning | global SELECT, write/DDL/admin/GRANT OPTION, `%`, role/cross-DB |
| schema 오류 | `schemas/` 권한·용량, metadata/View 권한, stale processing |
| GPT 오류 | OpenAI status, model access, quota/rate limit/timeout/context, 실패 이력 |
| SELECT 오류 | server validator, read-only 권한, timeout/row limit, schema freshness |
| 구버전 실행 | health commit, server HEAD/targetRef, LISTEN PID, start 실패, `app.log` |
| 9090 상속 | 양쪽 `lsof`, PID/PPID/PGID/SID, 정상 프로젝트 비교, Auto Deploy FD/pidfile |

## 16. 운영 전 필수와 권장

### 필수

- 승인된 `schema.md`, 관리 DB 초기화 및 repository/API 통합
- target DB CRUD/pool, schema 수집, GPT/SQL 이력과 SELECT 실행 통합
- Bun lock 생성·검토, dependency 설치, lint/typecheck/build 성공
- 서버 `.env`, secret 형식, management DB 연결, `schemas/` 권한
- 분석 전용 read-only target 계정과 SELECT-only 방어 검증
- foreground/start/health/build commit/port/9090 검증
- 사내 접근 경계와 HTTPS cookie 검증
- 실제 읽기 전용 E2E 성공

### 권장

- 분석 Read Replica와 DB별 전용 계정
- VPN/IP allowlist, 사용자별 계정·권한
- OpenAI project budget/usage limit 및 환경별 키 분리
- 관리 DB, secret store의 `.env`, `schemas/`, Auto Deploy 설정 백업
- app log rotation, disk/health/error monitoring과 알림
- credential/session key 회전 절차와 schema artifact 정리 정책

