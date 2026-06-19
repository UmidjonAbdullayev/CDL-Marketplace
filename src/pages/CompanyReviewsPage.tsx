import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CompanyReviewsPanel } from "../components/CompanyReviewsPanel";

export default function CompanyReviewsPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  if (!companyId) {
    return (
      <div className="page active">
        <p className="t-secondary">Company not found.</p>
      </div>
    );
  }

  return (
    <div className="page active">
      <div className="page-header inline">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="icon-sm" /> Back
        </button>
        <div>
          <h2>Partner Reviews</h2>
          <p className="t-secondary">Ratings from carriers, recruiters, and agencies on completed platform deals.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <CompanyReviewsPanel companyId={companyId} />
        </div>
      </div>
    </div>
  );
}
