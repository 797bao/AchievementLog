import React from 'react';

export default function FloatingUI({ totalStats, showBreadcrumb, milestoneName }) {
  return (
    <>
      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div className="float-breadcrumb">
          <span className="current">{milestoneName}</span>
        </div>
      )}

      {/* Stats pill — top-left, below breadcrumb, 2-row layout */}
      <div className="stats-pill">
        <div className="sp-row">
          <span className="sp-val">{totalStats.done}/{totalStats.total}</span> tasks
          <span className="sp-sep">|</span>
          <span className="sp-val">{totalStats.pct}%</span>
        </div>
        <div className="sp-row">
          <span className="sp-val">{totalStats.loggedTime}</span> / {totalStats.totalTime}
        </div>
      </div>
    </>
  );
}
