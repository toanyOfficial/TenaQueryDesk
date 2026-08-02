import { recentMessages, updateConversationSummary } from "./conversation-repository";
import type { Conversation } from "./conversation-types";

/** A bounded, deterministic summary avoids an extra model call and never includes tool payloads/results. */
export async function refreshConversationSummary(conversation:Conversation){if(conversation.messageCount<20||conversation.messageCount%10!==0)return false;const messages=await recentMessages(conversation.id,8);const summary=messages.map(message=>`${message.role==="user"?"사용자":"답변"}: ${message.content.replace(/\s+/g," ").slice(0,500)}`).join("\n");await updateConversationSummary(conversation.id,summary);return true;}
