---
id: service-admin-guide
title: 관리자 이용 가이드
category: service
tags: ["관리자", "DB 등록", "스키마 생성"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: DB 등록부터 스키마 생성까지 관리자 절차
---

# 신규 DB 등록
관리 화면에서 연결 키, 표시 이름, host, port, database name, username, password를 입력해 등록합니다. 연결 키는 스키마 저장 위치를 식별하는 안정적인 영문 키입니다.
## 연결 테스트와 권한
등록 후 연결 테스트와 권한 확인을 실행합니다. 대상 계정은 SELECT, SHOW VIEW, USAGE 중심의 읽기 전용 권한을 권장합니다.
## 스키마 파일 생성
스키마 파일 생성 기능으로 최신 snapshot을 만듭니다. 성공 후 분석 화면의 스키마 상태를 확인합니다. DB 구조 변경 후에는 다시 생성합니다.
## 확인 순서
등록 오류는 입력값과 관리 DB 상태, 연결 오류는 host·port·네트워크·계정, 생성 오류는 metadata 조회 권한을 순서대로 확인합니다.
