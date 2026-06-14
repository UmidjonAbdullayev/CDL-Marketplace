import { useEffect, useMemo, useRef, useState } from "react";
import { MessengerPanel } from "../components/chat/MessengerPanel";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { isOwnInboxMessage } from "../services/marketplace";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessagesPage() {
  const { sessionUser } = useApp();
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
    conversationMessages: messages,
    messagesLoading,
    sendConversationMessage
  } = useExchangeData();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === active) ?? conversations[0],
    [conversations, active]
  );

  const myCompanyId = sessionUser?.companyId ?? "";
  const buyerCompanyId = activeConv?.buyer_company_id ?? "";

  const bubbles = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        body: m.body,
        isMine: isOwnInboxMessage(m, myCompanyId, buyerCompanyId),
        attachmentName: m.attachment_name,
        timeLabel: formatMsgTime(m.created_at)
      })),
    [messages, myCompanyId, buyerCompanyId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConv?.id]);

  const send = async () => {
    if (!input.trim() || !activeConv || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await sendConversationMessage(text);
    } finally {
      setSending(false);
    }
  };

  if (listLoading && conversations.length === 0) {
    return (
      <div className="page active">
        <PageHeader title="Messages" desc="Communicate with sellers, buyers, and CDL Exchange support." />
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
      <PageHeader title="Messages" desc="Communicate with sellers, buyers, and CDL Exchange support." />
      {listRefreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
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
              className="messenger-panel--embedded"
              title={chatTitle}
              messages={bubbles}
              loading={messagesLoading}
              emptyMessage="No messages yet. Start the conversation."
              value={input}
              onChange={setInput}
              onSend={() => void send()}
              sending={sending}
              messagesEndRef={messagesEndRef}
            />
          ) : (
            <div className="messages-empty t-secondary">No conversations yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
