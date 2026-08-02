import {describe,expect,test} from "bun:test";
import {assertConversationAccess} from "./conversation-access-policy";
import {EMPTY_WORKING_STATE,type Conversation} from "./conversation-types";
const conversation={id:"00000000-0000-4000-8000-000000000001",userId:"user-a",title:"주문 조회",connectionId:1,status:"active",createdAt:new Date(0).toISOString(),lastActivityAt:new Date(0).toISOString(),schemaVersion:"v000001",model:"model",stateVersion:0,summary:null,messageCount:0,lastQuestion:null,hasSql:false,executed:false} satisfies Conversation;
describe("conversation access policy",()=>{test("allows only the owner on the bound connection",()=>{expect(assertConversationAccess(conversation,"user-a",1)).toBe(conversation);expectCode(()=>assertConversationAccess(conversation,"user-b",1),"CONVERSATION_ACCESS_DENIED");expectCode(()=>assertConversationAccess(conversation,"user-a",2),"CONVERSATION_CONNECTION_MISMATCH");});test("blocks archived conversations",()=>{expectCode(()=>assertConversationAccess({...conversation,status:"archived"},"user-a",1),"CONVERSATION_CLOSED");});});
test("empty working state contains no SQL or persisted result rows",()=>{expect(EMPTY_WORKING_STATE).toMatchObject({lastSql:null,validatedSql:null,executedSql:null,resultSummary:null,tables:[],columns:[],executed:false,version:0});expect(JSON.stringify(EMPTY_WORKING_STATE)).not.toContain("rows");});

function expectCode(fn:()=>unknown,code:string){try{fn();throw new Error("not thrown");}catch(error){expect((error as {code?:string}).code).toBe(code);}}
