---
id: operations-schema-generation
title: 스키마 생성 및 버전 관리
category: operations
tags: ["current.json", "manifest", "스키마 버전"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["admin"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: 스키마 snapshot 생성과 재생성 기준
---

# 생성 과정
서버가 information_schema에서 테이블, 뷰, 컬럼, 인덱스와 명시적 FK를 읽고 immutable version 디렉터리에 기록합니다.
## 생성 파일
manifest.json은 객체 목록, relationships.json은 명시적 FK, tables의 JSON은 객체별 상세입니다. current.json은 최신 성공 version과 구조 hash를 가리킵니다.
## 최신 기준
Agent는 current.json이 가리키는 정적 snapshot을 사용합니다. 생성 시각만으로 실제 DB와 현재 파일이 동일하다고 단정하지 않습니다.
## 재생성
테이블·컬럼·인덱스·FK·뷰가 변경됐거나 파일 누락·손상이 의심되면 관리자 화면에서 재생성합니다. 실패 시 metadata 권한, 연결 상태와 서버 저장 권한을 확인합니다.
