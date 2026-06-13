import { useMemo, useState } from "react";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useExchangeData } from "../context/ExchangeDataContext";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";

type Message = { side: "in" | "out"; text: string; time: string };

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function MessagesPage() {
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

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === active) ?? conversations[0],
    [conversations, active]
  );

  const allMsgs: Message[] = useMemo(
    () => messages.map((m) => ({
      side: m.direction as "in" | "out",
      text: m.body,
      time: formatMsgTime(m.created_at)
    })),
    [messages]
  );

  const send = () => {
    if (!input.trim() || !activeConv) return;
    const text = input;
    setInput("");
    void sendConversationMessage(text);
  };

  if (listLoading && conversations.length === 0) {
    return (
      <div className="page active">
        <PageHeader title="Messages" desc="Communicate with sellers, buyers, and CDL Exchange support." />
        <p className="t-secondary">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="page active">
      <PageHeader title="Messages" desc="Communicate with sellers, buyers, and CDL Exchange support." />
      {listRefreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="messages-layout">
        <div>
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
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={listLoading || listRefreshing} onPageChange={setPage} />
        </div>
        <div className="chat-area" id="chatArea">
          {activeConv ? (
            <>
              <div className="chat-header">{activeConv.subject || activeConv.companies?.name}</div>
              <div className="chat-messages" id="chatMessages">
                {messagesLoading ? (
                  <div className="t-secondary" style={{ padding: 16 }}>Loading messages...</div>
                ) : (
                  allMsgs.map((m, i) => <div key={`${m.time}-${i}`} className={`msg ${m.side}`}>{m.text}<div className="time">{m.time}</div></div>)
                )}
              </div>
              <div className="chat-input">
                <input type="text" id="chatInput" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn btn-primary" id="sendChat" onClick={send}>Send</button>
              </div>
            </>
          ) : (
            <div className="t-secondary" style={{ padding: 24 }}>No conversations yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
