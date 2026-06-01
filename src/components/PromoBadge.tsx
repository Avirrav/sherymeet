import React from 'react';

export default function PromoBadge() {
  return (
    <div className="mb-6 px-4 py-1 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-xs font-semibold text-brand-orange inline-flex items-center gap-1.5 animate-fade-in">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-ping" />
      <span>LEARN. BUILD. GET PLACED.</span>
    </div>
  );
}
