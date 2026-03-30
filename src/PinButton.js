import React from 'react';

function PinButton({ pinned, onClick }) {
  return (
    <button
      className={`pin-btn ${pinned ? 'pinned' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={pinned ? 'Unpin' : 'Pin to Inbox'}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={pinned ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 17v5" />
        <path d="M9 2h6l-1 7h4l-5 8h-2l-5-8h4L9 2z" />
      </svg>
    </button>
  );
}

export default PinButton;
