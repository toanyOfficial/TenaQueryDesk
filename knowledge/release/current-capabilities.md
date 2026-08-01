---
id: release-current-capabilities
title: 현재 기능 및 제한
category: release
tags: ["지원 기능", "제한", "release"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["user", "admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: 현재 코드에서 지원하거나 지원하지 않는 기능
---

# 현재 지원 기능
Agent tool calling, 선택 DB 안전 정보, 스키마 요약·버전·목록·검색·상세·명시적 FK 관계, 정적 지식 문서 목록·검색·구간 읽기, 확인된 스키마 기반 SELECT 초안을 지원합니다.
## 현재 지원하지 않는 기능
Agent의 실제 SQL 검증·실행, 실행 오류 기반 자동 수정, 요청 간 대화 메시지 영속화, 관리자 문서 편집 UI, GitHub 검색과 배포 UI 자동 탐색은 지원하지 않습니다.
## 상태 정보
이 문서는 기능 범위를 설명합니다. 특정 DB의 연결 및 스키마 생성 상태는 get_selected_database_context와 get_schema_version 같은 실시간 서버 도구 결과를 우선합니다.
