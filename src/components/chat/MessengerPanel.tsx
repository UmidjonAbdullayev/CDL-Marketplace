import { Paperclip, Send } from "lucide-react";
import { useRef, type ChangeEvent, type RefObject } from "react";

export type MessengerBubble = {
  id: string;
  body: string;
  isMine: boolean;
  isSystem?: boolean;
  attachmentName?: string | null;
  timeLabel: string;
};

type MessengerPanelProps = {
  title: string;
  live?: boolean;
  messages: MessengerBubble[];
  emptyMessage?: string;
  loading?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  onFileSelect?: (file: File) => void;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  className?: string;
};

export function MessengerPanel({
  title,
  live = false,
  messages,
  emptyMessage = "No messages yet.",
  loading = false,
  value,
  onChange,
  onSend,
  sending = false,
  onFileSelect,
  messagesEndRef,
  className = ""
}: MessengerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && onFileSelect) onFileSelect(file);
  };

  const handleSend = () => {
    if (!value.trim() || sending) return;
    onSend();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  return (
    <div className={`messenger-panel ${className}`.trim()}>
      <div className="messenger-panel-header">
        <span className="messenger-panel-title">{title}</span>
        {live ? <span className="messenger-live t-caption">Live</span> : null}
      </div>

      <div className="messenger-panel-messages">
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
                <div className="msg-attachment"><Paperclip className="icon-sm" /> {m.attachmentName}</div>
              ) : null}
              <div className="msg-bubble-time">{m.timeLabel}</div>
            </div>
          ))
        )}
        {messagesEndRef ? <div ref={messagesEndRef} /> : null}
      </div>

      <div className="messenger-panel-footer">
        {onFileSelect ? (
          <input
            ref={fileInputRef}
            type="file"
            className="messenger-file-input"
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
            onClick={() => fileInputRef.current?.click()}
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
