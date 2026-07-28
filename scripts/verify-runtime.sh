#!/usr/bin/env bash
set -u

port="${1:-${PORT:-}}"
if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  printf '사용법: bash scripts/verify-runtime.sh PROJECT_PORT\n' >&2
  exit 2
fi

failed=0
section() { printf '\n== %s ==\n' "$1"; }

section "Git HEAD"
head_commit="$(git rev-parse --short HEAD 2>/dev/null)" || { printf 'Git HEAD를 확인하지 못했습니다.\n'; failed=1; head_commit=""; }
[[ -n "$head_commit" ]] && printf '%s\n' "$head_commit"

section "Git 필수 파일"
if command -v bun >/dev/null 2>&1; then
  bun run verify:files || failed=1
else
  printf 'Bun이 없어 필수 파일 검증을 실행하지 못했습니다.\n'
  failed=1
fi

section "런타임 파일 (내용은 출력하지 않음)"
for path in .env schemas app.log; do
  if [[ -e "$path" ]]; then
    stat -c '%A %U:%G %n' "$path" 2>/dev/null || printf '존재: %s\n' "$path"
  else
    printf '누락: %s\n' "$path"
    [[ "$path" != "app.log" ]] && failed=1
  fi
done
[[ -d schemas && -w schemas ]] || { printf '경고: schemas 디렉터리에 현재 사용자 쓰기 권한이 없습니다.\n'; failed=1; }

section "관련 프로세스"
ps -eo pid,ppid,pgid,sid,user,stat,cmd | awk 'NR == 1 || /auto_deploy|tena-query-desk|next start|bun|node|php/ { print }'

section "LISTEN 포트"
if command -v lsof >/dev/null 2>&1; then
  lsof -n -P -iTCP:"$port" -sTCP:LISTEN || { printf '프로젝트 포트 %s LISTEN을 찾지 못했습니다.\n' "$port"; failed=1; }
  printf '%s\n' '-- 9090 (Auto Deploy 전용이어야 함) --'
  lsof -n -P -iTCP:9090 -sTCP:LISTEN || printf '9090 LISTEN 정보가 없거나 조회 권한이 없습니다. 필요하면 sudo로 다시 실행하세요.\n'
elif command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | awk -v target=":${port}" '$4 ~ target || $4 ~ /:9090$/ { print }' || true
  printf 'PID 소유자가 보이지 않으면 sudo lsof로 재확인하세요.\n'
else
  printf 'lsof/ss가 없어 LISTEN FD를 확인하지 못했습니다.\n'
  failed=1
fi

section "HTTP health"
if command -v curl >/dev/null 2>&1; then
  health_json="$(curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${port}/api/health")" || { printf '\nhealth 응답에 실패했습니다.\n'; failed=1; health_json=""; }
  [[ -n "$health_json" ]] && printf '%s\n' "$health_json"
  health_commit=""
  if [[ -n "$health_json" ]] && command -v bun >/dev/null 2>&1; then
    health_commit="$(printf '%s' "$health_json" | bun -e 'const x=JSON.parse(await Bun.stdin.text()); if(typeof x?.build?.commit!=="string") process.exit(1); process.stdout.write(x.build.commit)')" || true
  fi
  if [[ -z "$health_commit" || "$health_commit" == "unknown" ]]; then
    printf 'health build commit을 확인하지 못했습니다.\n'
    failed=1
  elif [[ -n "$head_commit" && "$health_commit" != "$head_commit" ]]; then
    printf '불일치: server HEAD=%s, health build=%s\n' "$head_commit" "$health_commit"
    failed=1
  else
    printf '일치: server HEAD=%s, health build=%s\n' "$head_commit" "$health_commit"
  fi
else
  printf 'curl이 없어 health 응답을 확인하지 못했습니다.\n'
  failed=1
fi

section "최근 포트 충돌"
if [[ -r app.log ]] && tail -n 200 app.log | grep -q 'EADDRINUSE'; then
  printf '경고: app.log 최근 200줄에서 EADDRINUSE를 발견했습니다.\n'
  failed=1
else
  printf '최근 EADDRINUSE를 발견하지 못했습니다.\n'
fi

if (( failed )); then
  printf '\n진단에서 확인이 필요한 항목이 발견되었습니다. 어떤 프로세스도 변경하거나 종료하지 않았습니다.\n' >&2
  exit 1
fi
printf '\n기본 진단을 통과했습니다. 프로젝트 프로세스가 9090 FD를 보유하지 않는지는 출력의 PID를 반드시 대조하세요.\n'
