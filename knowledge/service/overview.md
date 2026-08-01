---
id: service-overview
title: 서비스 개요
category: service
tags: ["Query Desk", "기능"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["user", "admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: 서비스 목적과 현재 지원 범위
---

# 목적
Tena Query Desk는 로그인한 사용자가 선택한 MySQL 대상 DB의 정적 스키마와 서비스 지식 문서를 Agent 도구로 확인해 설명과 읽기 전용 SQL 초안을 얻는 내부 도구입니다.
## 사용자와 관리자
사용자는 DB를 선택해 질문하고 SQL 초안을 검토합니다. 관리자는 DB 연결 등록, 연결 테스트, 권한 확인과 스키마 생성을 수행합니다.
## 현재 지원
Agent 도구 호출, DB 기본 정보, 스키마 요약·검색·테이블 상세·명시적 FK 관계, 정적 문서 목록·검색·읽기, SELECT 초안 생성을 지원합니다.
## 미지원
SQL 실제 실행, 실행 오류 자동 수정, 요청 간 대화 영속화, GitHub 검색은 지원하지 않습니다.
