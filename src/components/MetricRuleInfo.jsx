import React from "react";

export default function MetricRuleInfo({ title, children }) {
  return (
    <details className="metric-rule-info">
      <summary aria-label={`Como é calculado: ${title}`} title={`Como é calculado: ${title}`}>
        <i className="fas fa-circle-info" />
      </summary>
      <div className="metric-rule-popover" role="note">
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </details>
  );
}
