import React from "react";

export default function BrandLockup({ compact = false, children = null }) {
  return (
    <div className={`brand-lockup${compact ? " compact" : ""}`} aria-label="Alliance Jiu Jitsu Kids">
      <img src="alliance-eagle-mark-closed.png" className="brand-lockup-mark" alt="" />
      <div className="brand-lockup-copy">
        <div className="brand-lockup-name">Alliance</div>
        <div className="brand-lockup-line">
          <span>Jiu Jitsu</span>
          <span className="brand-kids" aria-label="Kids">
            <span className="kids-k">K</span><span className="kids-i">i</span><span className="kids-d">d</span><span className="kids-s">s</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
