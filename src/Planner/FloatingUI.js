import React from 'react';

export default function FloatingUI({ totalStats, showBreadcrumb, milestoneName }) {
  return (
    <>
      {/* Stats pill */}
      <div className="stats-pill">
        <span className="sp-val">{totalStats.done}/{totalStats.total}</span> tasks{' '}
        <span className="sp-sep">|</span>{' '}
        <span className="sp-val">{totalStats.pct}%</span>{' '}
        <span className="sp-sep">|</span>{' '}
        <span className="sp-val">{totalStats.doneTime}</span> / {totalStats.totalTime}
      </div>

      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div className="float-breadcrumb">
          <span className="current">{milestoneName}</span>
        </div>
      )}
    </>
  );
}
