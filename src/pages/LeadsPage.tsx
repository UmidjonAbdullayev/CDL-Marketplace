import { CompanyLeadsPanel } from "../components/leads/CompanyLeadsPanel";
import { useApp } from "../context/AppContext";

export default function LeadsPage() {
  const { sessionUser } = useApp();

  return (
    <div className="page active leads-page">
      {sessionUser?.companyId ? (
        <CompanyLeadsPanel />
      ) : (
        <div className="card marketplace-empty">
          <p className="t-body">Sign in to view your company leads.</p>
        </div>
      )}
    </div>
  );
}
