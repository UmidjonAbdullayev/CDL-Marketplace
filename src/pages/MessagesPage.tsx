import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessengerPanel } from "../components/chat/MessengerPanel";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import {
  DEFAULT_PAGE_SIZE,
  fetchConversationMessages,
  isOwnInboxMessage,
  sendConversationFile,
  sendMessage,
  subscribeConversationMessages,
  type MessageRow
} from "../services/marketplace";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessagesPage() {
  const { sessionUser, showToast } = useApp();
  const {
    messagesPage: page,
    setMessagesPage: setPage,
    conversations,
    conversationsTotal: total,
    conversationsTotalPages: totalPages,
    conversationsLoading: listLoading,
    conversationsRefreshing: listRefreshing,
    activeConversationId: active,
    selectConversation: setActive,
    refreshConversations
  } = useExchangeData();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === active) ?? conversations[0],
    [conversations, active]
  );

  const myCompanyId = sessionUser?.companyId ?? "";
  const buyerCompanyId = activeConv?.buyer_company_id ?? "";
  const conversationId = activeConv?.id ?? null;

  const pullMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setMessages(await fetchConversationMessages(conversationId));
    } catch {
      /* background refresh */
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    void pullMessages().finally(() => setMessagesLoading(false));
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeConversationMessages(conversationId, () => void pullMessages());
    return unsub;
  }, [conversationId, pullMessages]);

  const mergeMessage = (saved: MessageRow, tempId: string) => {
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
      return [...withoutTemp, saved];
    });
  };

  const send = async () => {
    if (!input.trim() || !conversationId || !activeConv || sending) return;
    const text = input.trim();
    setInput("");
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      direction: myCompanyId === buyerCompanyId ? "out" : "in",
      body: text,
      created_at: new Date().toISOString(),
      sender_company_id: myCompanyId,
      attachment_name: null,
      attachment_path: null,
      attachment_url: null
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const saved = await sendMessage(conversationId, text);
      if (saved) mergeMessage(saved, tempId);
      else void pullMessages();
      void refreshConversations(true);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  };

  const shareFile = async (file: File) => {
    if (!conversationId || !activeConv || sending) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      direction: myCompanyId === buyerCompanyId ? "out" : "in",
      body: `Shared file: ${file.name}`,
      created_at: new Date().toISOString(),
      sender_company_id: myCompanyId,
      attachment_name: file.name,
      attachment_path: null,
      attachment_url: null
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const saved = await sendConversationFile(conversationId, file);
      if (saved) mergeMessage(saved, tempId);
      else void pullMessages();
      void refreshConversations(true);
      showToast(`Shared: ${file.name}`, "success");
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("Failed to share file", "error");
    } finally {
      setSending(false);
    }
  };

  const bubbles = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        body: m.body,
        isMine: isOwnInboxMessage(m, myCompanyId, buyerCompanyId),
        attachmentName: m.attachment_name,
        attachmentPath: m.attachment_path,
        attachmentUrl: m.attachment_url,
        timeLabel: formatMsgTime(m.created_at)
      })),
    [messages, myCompanyId, buyerCompanyId]
  );

  if (listLoading && conversations.length === 0) {
    return (
      <div className="page active">
        <PageHeader title="Messages" desc="Chat with CDL Exchange platform admins about your active deals." />
        <p className="t-secondary">Loading conversations...</p>
      </div>
    );
  }

  const chatTitle = activeConv
    ? activeConv.is_support
      ? "CDL Exchange Support"
      : (activeConv.subject || (activeConv.companies?.name ?? "Conversation"))
    : "";

  return (
    <div className="page active messages-page">
      <PageHeader title="Messages" desc="Chat with CDL Exchange platform admins about your active deals." />
      {listRefreshing ? <div className="t-caption t-secondary messages-page-status">Updating...</div> : null}
      <div className="messages-layout">
        <div className="messages-sidebar">
          <div className="conv-list" id="convList">
            {conversations.map((c) => (
              <div key={c.id} className={`conv-item ${active === c.id ? "active" : ""}`} onClick={() => setActive(c.id)}>
                <div className="name">
                  {c.is_support ? "CDL Exchange Support" : (c.companies?.name ?? c.subject)}
                  {c.deal_id ? <span className="badge badge-blue" style={{ fontSize: 9 }}>Deal {c.deal_id}</span> : null}
                </div>
                <div className="preview">{c.subject}</div>
                <div className="time">{formatMsgTime(c.last_message_at)}</div>
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            loading={listLoading || listRefreshing}
            onPageChange={setPage}
          />
        </div>
        <div className="messages-chat-column">
          {activeConv ? (
            <MessengerPanel
              className="messenger-panel--embedded messenger-panel--docked"
              title={chatTitle}
              live
              messages={bubbles}
              loading={messagesLoading}
              emptyMessage="No messages yet. Start the conversation."
              value={input}
              onChange={setInput}
              onSend={() => void send()}
              sending={sending}
              onFileSelect={(file) => void shareFile(file)}
              focusKey={conversationId ?? undefined}
              messagesEndRef={messagesEndRef}
            />
          ) : (
            <div className="messages-empty t-secondary">No admin conversations yet. Chats open when you start a hiring process.</div>
          )}
        </div>
      </div>
    </div>
  );
}
