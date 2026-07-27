import React from 'react';

export default function PromoBadge() {
  return (
    <div className="mb-6 px-4 py-1 rounded-full bg-md-primary/10 border border-md-primary/20 text-xs font-semibold text-md-primary inline-flex items-center gap-1.5 animate-fade-in">
      <span className="w-1.5 h-1.5 rounded-full bg-md-primary animate-ping" />
      <span>LEARN. BUILD. GET PLACED.</span>
    </div>
  );
}
