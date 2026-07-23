import type { PolicyDocId } from "../../lib/policies";
import { PLATFORM_POLICY_RULES, POLICY_DOCUMENTS } from "../../lib/policies";

type Props = {
  docId: PolicyDocId;
  onClose: () => void;
};

export function PolicyAgreementModal({ docId, onClose }: Props) {
  const doc = POLICY_DOCUMENTS[docId];

  return (
    <div className="policy-modal-overlay" onClick={onClose}>
      <div className="policy-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <h3>{doc.title}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="card-body policy-modal-body scroll-y">
          <p className="t-secondary" style={{ marginBottom: 16 }}>{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.heading} style={{ marginBottom: 16 }}>
              <h4 className="t-card" style={{ marginBottom: 6 }}>{s.heading}</h4>
              <p className="t-secondary">{s.body}</p>
            </section>
          ))}
          <section>
            <h4 className="t-card" style={{ marginBottom: 8 }}>Platform rules</h4>
            <ol className="policy-rules-list">
              {PLATFORM_POLICY_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
