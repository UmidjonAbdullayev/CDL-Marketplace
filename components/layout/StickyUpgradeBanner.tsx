import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function StickyUpgradeBanner() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("cta_banner_hidden") === "1");

  if (hidden) return null;

  return (
    <div className="cta-banner cta-banner--sticky" id="ctaBanner">
      <div className="cta-text">
        <strong>Get More Exposure For Your Listings</strong>
        <span>Upgrade to featured listing and get 3× more views.</span>
      </div>
      <div className="cta-actions">
        <button type="button" className="btn-cta" onClick={() => navigate("/pricing")}>Upgrade Now</button>
        <button
          type="button"
          className="cta-close"
          onClick={() => {
            sessionStorage.setItem("cta_banner_hidden", "1");
            setHidden(true);
          }}
          aria-label="Close"
        >
          <X />
        </button>
      </div>
    </div>
  );
}
