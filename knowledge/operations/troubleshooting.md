---
id: operations-troubleshooting
title: 문제 해결 가이드
category: operations
tags: ["오류", "OpenAI", "스키마", "권한"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["user", "admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: GPT·DB·스키마·문서 검색 문제 확인 순서
---

# GPT 요청 실패
OpenAI 설정, 인증, 모델 접근, rate limit, 네트워크와 timeout을 확인합니다. 원본 비밀값이나 stack trace는 화면에 표시되지 않습니다.
## 스키마 관련 답변 실패
현재 schema version, 파일 생성 상태, 검색어와 테이블 comment를 확인합니다. 검색 결과가 없으면 요약이나 객체 목록으로 탐색할 수 있습니다.
## 스키마 미생성 또는 손상
관리 화면에서 스키마를 생성하거나 재생성합니다. current pointer가 가리키는 version 파일이 모두 있어야 합니다.
## DB 연결과 권한
host·port·계정과 SELECT·SHOW VIEW·metadata 권한을 확인합니다.
## 문서 검색 결과 없음
다른 표현이나 category 없이 검색하거나 active 문서 목록을 확인합니다. 이는 Agent 요청 전체 오류가 아닙니다.
## 현재 미지원
Agent SQL 실행, 실행 오류 자동 수정, GitHub 검색과 요청 간 대화 저장은 지원하지 않습니다.
