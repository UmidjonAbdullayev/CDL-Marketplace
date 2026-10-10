import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "../lib/badges";
import { DriverApplicationForm } from "../components/driver-applications/DriverApplicationForm";
import { parseDriverApplicationForm } from "../lib/driver-application-form";
import {
  fetchDriverApplicationByToken,
  parseApplicationDocuments,
  saveDriverApplicationProgress,
  uploadDriverApplicationDocument
} from "../services/driverApplications";
import type { DriverApplicationDocument, DriverApplicationFormData } from "../types/driver-application-form";

export default function DriverApplicationInvitePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formData, setFormData] = useState<DriverApplicationFormData>({});
  const [documents, setDocuments] = useState<DriverApplicationDocument[]>([]);
  const [appId, setAppId] = useState("");

  useEffect(() => {
    if (!token) return;
    void fetchDriverApplicationByToken(token)
      .then((row) => {
        if (!row) return;
        setAppId(row.id);
        setFirstName(row.driver_first_name ?? "");
        setLastName(row.driver_last_name ?? "");
        setEmail(row.driver_email ?? "");
        setPhone(row.driver_phone ?? "");
        setSubmitted(row.status === "submitted" || row.status === "reviewed");
        setFormData(parseDriverApplicationForm(row.form_data));
        setDocuments(parseApplicationDocuments(row.documents));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const persist = useCallback(
    async (submit: boolean) => {
      if (!appId) return;
      setSaving(true);
      try {
        await saveDriverApplicationProgress({
          id: appId,
          firstName,
          lastName,
          email,
          phone,
          formData,
          documents,
          submit
        });
        if (submit) setSubmitted(true);
      } finally {
        setSaving(false);
      }
    },
    [appId, firstName, lastName, email, phone, formData, documents]
  );

  const uploadDocument = async (file: File, label: string) => {
    if (!appId) return;
    setUploadingDoc(true);
    try {
      const next = await uploadDriverApplicationDocument(appId, file, label, documents);
      setDocuments(next);
      await persist(false);
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) return <div className="page active"><p className="t-secondary">Loading application...</p></div>;
  if (!appId) return <div className="page active"><p className="t-secondary">Application link invalid or expired.</p></div>;

  return (
    <div className="page active driver-application-invite-page">
      <PageHeader
        title="CDL Driver Employment Application"
        desc="Complete all sections below. Your information is shared with the recruiting company and hiring carrier reviewing your candidacy."
      />
      {submitted ? (
        <div className="card"><div className="card-body">
          <h3>Application submitted</h3>
          <p className="t-secondary">Thank you. The hiring team will review your application and contact you if you are a fit.</p>
        </div></div>
      ) : (
        <>
          <DriverApplicationForm
            formData={formData}
            documents={documents}
            firstName={firstName}
            lastName={lastName}
            email={email}
            phone={phone}
            onIdentityChange={(patch) => {
              if (patch.firstName != null) setFirstName(patch.firstName);
              if (patch.lastName != null) setLastName(patch.lastName);
              if (patch.email != null) setEmail(patch.email);
              if (patch.phone != null) setPhone(patch.phone);
            }}
            onFormChange={setFormData}
            onUploadDocument={uploadDocument}
            uploadingDoc={uploadingDoc}
          />
          <div className="driver-app-invite-actions">
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void persist(false)}>
              {saving ? "Saving..." : "Save progress"}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void persist(true)}>
              {saving ? "Submitting..." : "Submit application"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
