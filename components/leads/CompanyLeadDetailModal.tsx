import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  Truck,
  User,
  X
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  COMPANY_LEAD_STAGES,
  LEAD_DRIVER_TYPES,
  leadFullName,
  leadStageBadge,
  leadStageLabel
} from "../../lib/company-leads";
import { fmtDate } from "../../lib/format";
import {
  addLeadNote,
  fetchLeadNotes,
  updateCompanyLeadStage
} from "../../services/companyLeads";
import type { CompanyLead, CompanyLeadNote, CompanyLeadStage } from "../../types/company-leads";

type Props = {
  lead: CompanyLead;
  onClose: () => void;
  onUpdated: (lead: CompanyLead) => void;
};

export function CompanyLeadDetailModal({ lead, onClose, onUpdated }: Props) {
  const { sessionUser, showToast } = useApp();
  const [stage, setStage] = useState(lead.stage as CompanyLeadStage);
  const [notes, setNotes] = useState<CompanyLeadNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      setNotes(await fetchLeadNotes(lead.id));
    } catch {
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, [lead.id]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveStage = async (next: CompanyLeadStage) => {
    setStage(next);
    setSavingStage(true);
    try {
      await updateCompanyLeadStage(lead.id, next);
      onUpdated({ ...lead, stage: next, updated_at: new Date().toISOString() });
      showToast("Lead stage updated", "success");
    } catch (e) {
      setStage(lead.stage as CompanyLeadStage);
      showToast(e instanceof Error ? e.message : "Failed to update stage", "error");
    } finally {
      setSavingStage(false);
    }
  };

  const saveNote = async () => {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    try {
      const note = await addLeadNote(lead.id, noteDraft, sessionUser?.name ?? "User");
      setNotes((prev) => [note, ...prev]);
      setNoteDraft("");
      onUpdated({
        ...lead,
        notes_preview: note.body.slice(0, 160),
        updated_at: new Date().toISOString()
      });
      showToast("Note added", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save note", "error");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="lead-detail-overlay" onClick={onClose} role="presentation">
      <aside
        className="lead-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
      >
        <header className="lead-detail-header">
          <div className="lead-detail-identity">
            <div className="lead-detail-avatar">
              <User className="icon-md" />
            </div>
            <div>
              <h3>{leadFullName(lead)}</h3>
              <div className="lead-detail-sub">
                <span className={`badge ${leadStageBadge(stage)}`}>{leadStageLabel(stage)}</span>
                <span className="t-caption t-secondary">
                  Assigned {fmtDate(lead.assigned_at)}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X className="icon-sm" />
          </button>
        </header>

        <div className="lead-detail-body">
          <section className="lead-detail-section">
            <h4>Contact</h4>
            <div className="lead-detail-grid">
              <div><Phone className="icon-sm" /> {lead.phone || "—"}</div>
              <div><Mail className="icon-sm" /> {lead.email || "—"}</div>
              <div><MapPin className="icon-sm" /> {lead.state || "—"}</div>
              <div><Truck className="icon-sm" /> {lead.cdl_class || "—"}</div>
              <div><Calendar className="icon-sm" /> {lead.years_experience != null ? `${lead.years_experience} yrs exp` : "—"}</div>
              <div><User className="icon-sm" /> {lead.driver_type || "Any type"}</div>
            </div>
            {lead.endorsements ? (
              <p className="t-caption t-secondary" style={{ marginTop: 8 }}>Endorsements: {lead.endorsements}</p>
            ) : null}
          </section>

          <section className="lead-detail-section">
            <h4>Stage</h4>
            <div className="lead-stage-grid">
              {COMPANY_LEAD_STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`lead-stage-btn ${stage === s.key ? "active" : ""}`}
                  disabled={savingStage}
                  onClick={() => void saveStage(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="lead-detail-section">
            <h4>Notes</h4>
            <textarea
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note about this driver..."
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              disabled={savingNote || !noteDraft.trim()}
              onClick={() => void saveNote()}
            >
              {savingNote ? "Saving..." : "Add note"}
            </button>
            <div className="lead-notes-list">
              {loadingNotes ? (
                <p className="t-caption t-secondary">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="t-caption t-secondary">No notes yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="lead-note-item">
                    <div className="lead-note-meta">
                      <strong>{n.author_name}</strong>
                      <span className="t-caption t-secondary">{fmtDate(n.created_at)}</span>
                    </div>
                    <p>{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lead-detail-section">
            <h4>Meta</h4>
            <p className="t-caption t-secondary">
              Source: {lead.source} · Driver types: {LEAD_DRIVER_TYPES.join(", ")}
            </p>
            {lead.notes_preview && !notes.length ? (
              <p className="t-caption" style={{ marginTop: 6 }}>{lead.notes_preview}</p>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
}
