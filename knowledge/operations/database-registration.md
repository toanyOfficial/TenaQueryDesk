---
id: operations-database-registration
title: DB 등록 및 연결 관리
category: operations
tags: ["연결 키", "localhost", "권한", "등록 실패"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: 대상 DB 등록 입력값과 실패 원인
---

# 등록 입력 항목
연결 키는 파일 식별용 안정 키, 표시 이름은 화면 표시값입니다. host, port, database name, username과 password는 대상 MySQL 접속에 사용됩니다.
## 저장과 암호화
password는 평문으로 관리 DB에 저장하지 않고 서버 encryption key로 암호화합니다. 비밀번호와 host는 GPT 도구 결과에 제공하지 않습니다.
## 연결 키 규칙
소문자 영문·숫자와 제한된 점·밑줄·하이픈을 사용하며 경로 순회 형태는 금지됩니다. 등록 후 임의 변경하지 않습니다.
## localhost 주의
앱과 DB가 다른 컨테이너나 서버이면 localhost는 앱 자신을 가리킵니다. 실제 네트워크에서 접근 가능한 주소를 사용합니다.
## 등록 실패
중복 연결 키, 잘못된 port, 암호화 설정 누락, 관리 DB 오류를 확인합니다. 연결 실패는 네트워크와 MySQL 계정 범위를 확인합니다.
