import { useState } from "react";
import type { PolicyDocId } from "../../lib/policies";
import { PolicyAgreementModal } from "./PolicyAgreementModal";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PolicyAgreementCheckbox({ checked, onChange }: Props) {
  const [openDoc, setOpenDoc] = useState<PolicyDocId | null>(null);

  return (
    <>
      <div className="policy-agreement-box">
        <label className="policy-agreement-label">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span>
            I agree to the{" "}
            <button type="button" className="policy-link" onClick={() => setOpenDoc("marketplace")}>Marketplace User Policy</button>
            ,{" "}
            <button type="button" className="policy-link" onClick={() => setOpenDoc("fair_use")}>Fair Use Policy</button>
            , and{" "}
            <button type="button" className="policy-link" onClick={() => setOpenDoc("anti_circumvention")}>Anti-Circumvention Rules</button>.
          </span>
        </label>
      </div>
      {openDoc ? <PolicyAgreementModal docId={openDoc} onClose={() => setOpenDoc(null)} /> : null}
    </>
  );
}
