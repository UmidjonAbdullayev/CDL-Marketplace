import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessengerPanel } from "../components/chat/MessengerPanel";
import { AdminAvatar } from "../components/ui/AdminAvatar";
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
  const navigate = useNavigate();
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
        <PageHeader title="Messages" desc="Admin chats for your active deals — one thread per deal." />
        <p className="t-secondary">Loading conversations...</p>
      </div>
    );
  }

  const adminName = activeConv?.admin_name ?? "Platform Admin";
  const adminInitials = adminName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "PA";

  return (
    <div className="page active messages-page">
      <PageHeader title="Messages" desc="Admin chats for your active deals — one thread per deal." />
      {listRefreshing ? <div className="t-caption t-secondary messages-page-status">Updating...</div> : null}
      <div className="messages-layout">
        <div className="messages-sidebar">
          <div className="conv-list" id="convList">
            {conversations.length === 0 ? (
              <p className="t-secondary conv-list-empty">No admin chats yet. Chats open when you start a hiring process.</p>
            ) : (
              conversations.map((c) => {
                const label = c.deal_id
                  ? `Deal ${c.deal_id}${c.driver_label ? ` · ${c.driver_label}` : ""}`
                  : c.subject || "Admin chat";
                const convAdminName = c.admin_name ?? "Platform Admin";
                const convInitials = convAdminName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "PA";
                return (
                  <div
                    key={c.id}
                    className={`conv-item ${active === c.id ? "active" : ""}`}
                    onClick={() => setActive(c.id)}
                  >
                    <div className="conv-item-head">
                      <AdminAvatar
                        name={convAdminName}
                        initials={convInitials}
                        avatarUrl={c.admin_avatar_url}
                        size="sm"
                      />
                      <div className="name">{label}</div>
                    </div>
                    <div className="preview">
                      {c.admin_name ? `Admin: ${c.admin_name}` : "Platform admin chat"}
                    </div>
                    <div className="time">{formatMsgTime(c.last_message_at)}</div>
                    {c.deal_id ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm conv-open-deal"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/deals/${c.deal_id}`);
                        }}
                      >
                        Open deal
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
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
            <>
              <div className="messages-chat-admin-bar">
                <AdminAvatar
                  name={adminName}
                  initials={adminInitials}
                  avatarUrl={activeConv.admin_avatar_url}
                  size="md"
                />
                <div>
                  <strong>{adminName}</strong>
                  <p className="t-caption t-secondary">
                    {activeConv.deal_id ? `Deal ${activeConv.deal_id} admin chat` : "Platform admin chat"}
                  </p>
                </div>
              </div>
              <MessengerPanel
                className="messenger-panel--embedded messenger-panel--docked"
                title={adminName}
                hideHeader
                live
                messages={bubbles}
                loading={messagesLoading}
                emptyMessage="No messages yet. Message your assigned admin about this deal."
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                sending={sending}
                onFileSelect={(file) => void shareFile(file)}
                focusKey={conversationId ?? undefined}
                messagesEndRef={messagesEndRef}
              />
            </>
          ) : (
            <div className="messages-empty t-secondary">Select a deal chat from the left to message your admin.</div>
          )}
        </div>
      </div>
    </div>
  );
}
