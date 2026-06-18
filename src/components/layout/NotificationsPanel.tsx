import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { AppNotification } from "../../services/notifications";

export function NotificationsPanel({
  open,
  onClose,
  items,
  onMarkAllRead,
  onDismiss
}: {
  open: boolean;
  onClose: () => void;
  items: AppNotification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = document.getElementById("notifBtn");
        if (btn?.contains(e.target as Node)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-panel-head">
        <strong>Notifications</strong>
        {items.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onMarkAllRead}>Mark all read</button>
        ) : null}
      </div>
      <div className="notif-panel-body">
        {items.length === 0 ? (
          <p className="t-secondary" style={{ padding: 16 }}>You&apos;re all caught up.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`notif-item urgency-${n.urgency}`}
              onClick={() => {
                onDismiss(n.id);
                onClose();
                navigate(n.href);
              }}
            >
              <div className="notif-item-title">{n.title}</div>
              <div className="notif-item-body">{n.body}</div>
              <div className="notif-item-time">
                {new Date(n.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
