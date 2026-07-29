import { describe, expect, test } from "bun:test";
import { analysisUsageGuidance } from "./question-guidance";
const manifest={formatVersion:1 as const,connectionId:1,connectionKey:"ops",displayName:"단도락 OPS",dbType:"mysql" as const,databaseName:"dandorak",generatedAt:"2026-07-29T00:00:00Z",tableCount:34,viewCount:0,tables:[]};
describe("analysis usage guidance",()=>{
  test("explains a loaded schema for UI and capability questions",()=>{ expect(analysisUsageGuidance("오른쪽 위 target database가 관련 스키마 아니야?",manifest)?.answer).toContain("34개"); });
  test("recognizes a request for the connected schema information",()=>{ expect(analysisUsageGuidance("지금 이 대화창에 연결된 스키마 정보를 알려줘",manifest)?.answer).toContain("단도락 OPS"); });
  test("leaves concrete database questions to schema selection",()=>{ expect(analysisUsageGuidance("주문 상태별 건수를 알려줘",manifest)).toBeNull(); });
});
