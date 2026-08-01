---
id: service-user-guide
title: 사용자 이용 가이드
category: service
tags: ["질문", "SQL 초안", "대상 DB"]
status: active
updated_at: 2026-07-29
version: 1
audience: ["user"]
related_documents: []
related_tools: []
related_routes: []
source_of_truth: true
summary: 분석 화면 질문과 SQL 초안 사용법
---

# 질문 입력
분석 화면 오른쪽 위에서 대상 DB를 선택하고 GPT 질문 및 답변 영역에 질문합니다. 일반 서비스 질문과 DB 구조 질문을 모두 입력할 수 있습니다.
## DB 질문 예시
“주문 관련 테이블을 찾아줘”, “확인된 컬럼으로 월별 조회 SQL을 만들어줘”처럼 목적과 기준을 구체적으로 작성합니다.
## SQL 확인
생성된 SQL은 오른쪽 SQL 편집기에 반영될 수 있습니다. 현재 Agent SQL은 실제 DB에서 실행 검증되지 않은 초안입니다.
## 후속 질문
브라우저는 conversation ID를 이어 보내지만 서버의 요청 간 메시지 저장소는 아직 없습니다. “아까 쿼리”만으로는 문맥이 복원되지 않을 수 있으므로 필요한 SQL과 조건을 다시 적습니다.
## 제한
스키마 미생성·손상, OpenAI 설정 오류, 불명확한 업무 기준에서는 답변이 제한됩니다.
