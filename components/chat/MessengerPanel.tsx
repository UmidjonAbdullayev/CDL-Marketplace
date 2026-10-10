import { Paperclip, Send } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type RefObject } from "react";
import { getAttachmentViewUrl, openAttachment } from "../../services/chatAttachments";

export type MessengerBubble = {
  id: string;
  body: string;
  isMine: boolean;
  isSystem?: boolean;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentUrl?: string | null;
  timeLabel: string;
};

type MessengerPanelProps = {
  title: string;
  live?: boolean;
  hideHeader?: boolean;
  messages: MessengerBubble[];
  emptyMessage?: string;
  loading?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  onFileSelect?: (file: File) => void;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  focusKey?: string;
  className?: string;
};

export function MessengerPanel({
  title,
  live = false,
  hideHeader = false,
  messages,
  emptyMessage = "No messages yet.",
  loading = false,
  value,
  onChange,
  onSend,
  sending = false,
  onFileSelect,
  messagesEndRef,
  focusKey,
  className = ""
}: MessengerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const internalEndRef = useRef<HTMLDivElement>(null);
  const endRef = messagesEndRef ?? internalEndRef;

  const focusInput = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const scrollMessagesToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    focusInput();
  }, [focusKey]);

  useEffect(() => {
    if (!sending) focusInput();
  }, [sending]);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages.length, messages[messages.length - 1]?.id, loading]);

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && onFileSelect) onFileSelect(file);
    focusInput();
  };

  const handleSend = () => {
    if (!value.trim() || sending) return;
    onSend();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    requestAnimationFrame(scrollMessagesToBottom);
    focusInput();
  };

  const viewAttachment = async (m: MessengerBubble) => {
    const url = m.attachmentUrl ?? (m.attachmentPath ? getAttachmentViewUrl(m.attachmentPath) : null);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (m.attachmentPath && m.attachmentName) {
      try {
        await openAttachment(m.attachmentPath, m.attachmentName);
      } catch {
        /* parent may show toast */
      }
    }
  };

  return (
    <div className={`messenger-panel ${className}`.trim()}>
      {!hideHeader ? (
        <div className="messenger-panel-header">
          <span className="messenger-panel-title">{title}</span>
          {live ? <span className="messenger-live t-caption">Live</span> : null}
        </div>
      ) : null}

      <div ref={messagesContainerRef} className="messenger-panel-messages">
        {loading ? (
          <p className="messenger-empty t-secondary">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="messenger-empty t-secondary">{emptyMessage}</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`msg-bubble ${m.isMine ? "msg-bubble-out" : "msg-bubble-in"} ${m.isSystem ? "msg-bubble-system" : ""}`}
            >
              <div className="msg-bubble-body">{m.body}</div>
              {m.attachmentName ? (
                <button
                  type="button"
                  className="msg-attachment msg-attachment-link"
                  onClick={() => void viewAttachment(m)}
                >
                  <Paperclip className="icon-sm" /> {m.attachmentName}
                </button>
              ) : null}
              <div className="msg-bubble-time">{m.timeLabel}</div>
            </div>
          ))
        )}
        <div ref={endRef} className="messenger-messages-end" aria-hidden="true" />
      </div>

      <div className="messenger-panel-footer">
        {onFileSelect ? (
          <input
            ref={fileInputRef}
            type="file"
            className="file-input-hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
            onChange={onFileChosen}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          className="messenger-textarea"
          rows={1}
          placeholder="Write a message…"
          value={value}
          disabled={sending}
          autoFocus
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        {onFileSelect ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm messenger-attach"
            title="Attach file"
            disabled={sending}
            onClick={() => {
              fileInputRef.current?.click();
              focusInput();
            }}
          >
            <Paperclip className="icon-sm" />
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary messenger-send"
          disabled={sending || !value.trim()}
          onClick={handleSend}
        >
          <Send className="icon-sm" />
        </button>
      </div>
    </div>
  );
}
