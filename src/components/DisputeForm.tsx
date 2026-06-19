import { useEffect, useRef, useState } from "react";
import { Paperclip, UploadCloud } from "lucide-react";
import { uploadChatAttachment } from "../services/chatAttachments";
import { createDispute, fetchDealsForSelect } from "../services/marketplace";

type Props = {
  presetDealId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  showToast: (message: string, type?: "" | "success" | "error") => void;
};

export function DisputeForm({ presetDealId, onSuccess, onCancel, showToast }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deals, setDeals] = useState<{ id: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dealId, setDealId] = useState(presetDealId ?? "");
  const [reason, setReason] = useState("Invalid phone");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<{ name: string; path: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchDealsForSelect().then((rows) => {
      setDeals(rows);
      setDealId((current) => current || presetDealId || rows[0]?.id || "");
      setLoaded(true);
    });
  }, [presetDealId]);

  const onFileChosen = async (file: File) => {
    try {
      const uploaded = await uploadChatAttachment(file, "disputes");
      setEvidence({ name: uploaded.name, path: uploaded.path });
      showToast(`Attached: ${uploaded.name}`, "success");
    } catch {
      showToast("Failed to upload evidence", "error");
    }
  };

  const submit = async () => {
    if (!dealId) {
      showToast("Select a deal first", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createDispute(dealId, reason, description, evidence ?? undefined);
      onSuccess();
      showToast("Dispute filed — admin will review within 48hrs", "success");
    } catch {
      showToast("Failed to file dispute", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-group">
        <label>Deal ID</label>
        <select value={dealId} onChange={(e) => setDealId(e.target.value)} disabled={!loaded}>
          {!loaded ? <option value="">Loading deals…</option> : null}
          {loaded && deals.length === 0 && !presetDealId ? <option value="">No eligible deals</option> : null}
          {loaded && deals.length === 0 && presetDealId ? <option value={presetDealId}>{presetDealId}</option> : null}
          {deals.map((d) => (
            <option key={d.id} value={d.id}>{d.id}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Reason</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option>Invalid phone</option>
          <option>Driver not interested</option>
          <option>Duplicate lead</option>
          <option>Missing consent</option>
          <option>Fake listing</option>
          <option>Other</option>
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea rows={3} placeholder="Describe the issue..." value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Evidence (optional)</label>
        <input
          ref={fileInputRef}
          type="file"
          className="messenger-file-input"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFileChosen(file);
          }}
        />
        <div
          className="upload-zone dispute-upload-zone"
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <UploadCloud />
          <div className="t-body">Upload evidence (screenshots, call logs, PDFs)</div>
          {evidence ? (
            <div className="dispute-evidence-tag"><Paperclip className="icon-sm" /> {evidence.name}</div>
          ) : (
            <div className="t-caption t-secondary" style={{ marginTop: 8 }}>Click to browse files</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={() => void submit()} disabled={submitting || !dealId}>
          {submitting ? "Submitting…" : "Submit Dispute"}
        </button>
      </div>
    </>
  );
}
