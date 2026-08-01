---
id: service-query-desk-guide
title: Query Desk 질문 처리 가이드
category: service
tags: ["Agent", "도구 호출", "SQL"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["user", "admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: Agent의 스키마·문서 탐색과 SQL 초안 의미
---

# 질문 처리
GPT가 질문 의도를 판단하고 필요한 스키마 또는 지식 문서 도구를 선택합니다. 서버는 도구 입력, connection, 시간과 결과 크기를 검증합니다.
## 스키마 탐색
업무 표현은 스키마 검색으로 후보를 찾고 테이블 상세와 명시적 FK 관계를 추가 확인합니다. 검색 결과 없음은 요청 전체 실패가 아닙니다.
## 문서 탐색
서비스 절차와 운영 정책은 문서 검색 후 필요한 구간을 읽습니다. 현재 상태 질문은 정적 문서보다 상태 도구 결과가 우선입니다.
## SQL 초안
확인된 테이블과 컬럼으로 SELECT 또는 WITH 초안만 작성합니다. 실제 실행·검증 기능은 아직 Agent에 연결되지 않았으므로 성공을 보장하지 않습니다.
