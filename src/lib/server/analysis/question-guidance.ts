import type { GeneratedQueryResponse } from "@/lib/server/openai/types";
import type { SchemaManifest } from "@/lib/server/schema/types";

const USAGE_QUESTION = /(?:여기|너|서비스|화면|대화창).{0,25}(?:질문|대답|답변|스키마)|(?:target database|오른쪽 위|연결된|현재).{0,30}(?:스키마|schema)|(?:스키마|schema).{0,20}(?:정보|알려|정상)|(?:어떤 문제|무슨 문제)/iu;

/** Answers questions about the analysis screen itself without spending an
 * OpenAI request or pretending that those words identify a business table. */
export function analysisUsageGuidance(question: string, manifest: SchemaManifest): GeneratedQueryResponse | null {
  if (!USAGE_QUESTION.test(question)) return null;
  const total=manifest.tableCount+manifest.viewCount;
  return {
    requestType:"schema_explanation",
    answer:`네. 현재 ${manifest.displayName}의 스키마 ${total}개 객체를 기준으로 DB 구조와 조회 SQL에 관한 질문에 답할 수 있습니다. 화면의 스키마 표시는 파일이 정상 생성됐다는 뜻입니다. 다만 각 질문은 독립적으로 처리되므로 “어떤 문제야?” 대신 “주문 테이블의 상태 컬럼을 설명해 줘”처럼 업무명·테이블·컬럼을 포함해 주세요.`,
    sql:null, referencedTables:[], assumptions:[], warnings:[], riskLevel:"read_only",
    transactionGuidance:{applicable:false,summary:null}, executionPlan:null,
  };
}
