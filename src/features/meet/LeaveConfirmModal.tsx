'use client';

import React from 'react';
import { LogOut } from 'lucide-react';

interface LeaveConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LeaveConfirmModal({ onConfirm, onCancel }: LeaveConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-surface border border-brand-border p-6 rounded-3xl max-w-sm w-full mx-4 shadow-2xl glass-panel text-center animate-scale-in">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <LogOut className="w-6 h-6" />
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">Leave Meeting?</h3>
        <p className="text-xs text-brand-text-secondary mb-6">
          Are you sure you want to exit? You will be disconnected from the active session.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-press flex-1 bg-brand-dark hover:bg-brand-border border border-brand-border py-2.5 rounded-xl text-xs font-semibold text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-press flex-1 bg-red-600 hover:bg-red-700 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg shadow-red-600/15"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
