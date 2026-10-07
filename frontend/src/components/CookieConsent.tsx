import React, { useState, useEffect } from "react";

const CONSENT_KEY = "james_cookie_consent";

export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <p>
        James uses local storage for analytics only — no external tracking. By
        continuing, you consent to local data storage.
      </p>
      <div className="cookie-banner-actions">
        <button type="button" className="cookie-decline" onClick={decline}>
          Decline
        </button>
        <button type="button" className="cookie-accept" onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
};
