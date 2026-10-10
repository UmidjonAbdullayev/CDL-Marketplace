import { useEffect, useState } from "react";
import { FileSignature, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../lib/badges";
import { fmtDate, fmtRecruitingFee } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchDealContracts, policiesFromAccount, type AcceptedPolicies, type DealContractRecord } from "../services/compliance";
import { fetchRegistrationById } from "../services/registration";

function PolicyDocBlock({ title, intro, sections }: { title: string; intro: string; sections: { heading: string; body: string }[] }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><h3>{title}</h3></div>
      <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
        <p className="t-secondary" style={{ marginBottom: 12 }}>{intro}</p>
        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 14 }}>
            <strong>{s.heading}</strong>
            <p style={{ marginTop: 4 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const { sessionUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<AcceptedPolicies | null>(null);
  const [contracts, setContracts] = useState<DealContractRecord[]>([]);

  useEffect(() => {
    if (!sessionUser?.id) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const account = await fetchRegistrationById(sessionUser.id);
        if (account) setPolicies(policiesFromAccount(account));
        if (isSupabaseConfigured && sessionUser.companyId) {
          setContracts(await fetchDealContracts());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionUser?.id, sessionUser?.companyId]);

  if (loading) {
    return (
      <div className="page active">
        <p className="t-secondary">Loading compliance documents...</p>
      </div>
    );
  }

  return (
    <div className="page active">
      <PageHeader
        title="Compliance Center"
        desc="Your registration agreements and recruiting contracts on CDL Exchange."
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3><ShieldCheck className="icon-md" style={{ verticalAlign: -3 }} /> Registration Agreements</h3>
        </div>
        <div className="card-body" style={{ fontSize: 13 }}>
          {policies?.acceptedAt ? (
            <p style={{ marginBottom: 16 }}>
              You accepted platform policies <strong>version {policies.version}</strong> on{" "}
              <strong>{fmtDate(policies.acceptedAt)}</strong>.
            </p>
          ) : (
            <p className="t-secondary" style={{ marginBottom: 16 }}>No policy acceptance record found.</p>
          )}
          <div style={{ marginBottom: 16 }}>
            <h4 className="t-card" style={{ marginBottom: 8 }}>Platform rules you agreed to</h4>
            <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
              {policies?.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {policies ? (
        <>
          <PolicyDocBlock
            title={policies.documents.marketplace.title}
            intro={policies.documents.marketplace.intro}
            sections={policies.documents.marketplace.sections}
          />
          <PolicyDocBlock
            title={policies.documents.fair_use.title}
            intro={policies.documents.fair_use.intro}
            sections={policies.documents.fair_use.sections}
          />
          <PolicyDocBlock
            title={policies.documents.anti_circumvention.title}
            intro={policies.documents.anti_circumvention.intro}
            sections={policies.documents.anti_circumvention.sections}
          />
        </>
      ) : null}

      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-header">
          <h3><FileSignature className="icon-md" style={{ verticalAlign: -3 }} /> Recruiting Contracts</h3>
        </div>
        <div className="card-body">
          {contracts.length === 0 ? (
            <p className="t-secondary">
              No recruiting agreements yet. Contracts are created when you start or participate in a hiring process
              from the marketplace.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Driver</th>
                    <th>Parties</th>
                    <th>Buyer signed</th>
                    <th>Seller signed</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.dealId}>
                      <td>{c.dealId}</td>
                      <td>{c.driverLabel}</td>
                      <td>{c.buyerCompany} ↔ {c.sellerCompany}</td>
                      <td>
                        {c.buyerSignedAt
                          ? `${c.buyerSigner ?? "—"} · ${fmtDate(c.buyerSignedAt)}`
                          : "Pending"}
                      </td>
                      <td>
                        {c.sellerSignedAt
                          ? `${c.sellerSigner ?? "—"} · ${fmtDate(c.sellerSignedAt)}`
                          : "Pending"}
                      </td>
                      <td>{fmtRecruitingFee(c.amount)}</td>
                      <td><span className="badge badge-blue">{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
