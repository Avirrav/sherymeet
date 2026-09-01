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
      <div className="bg-md-surface-container-high border border-md-outline-variant/50 p-6 rounded-md-xl max-w-sm w-full mx-4 text-center animate-scale-in">
        <div className="w-12 h-12 bg-md-error-container text-md-on-error-container rounded-md-lg flex items-center justify-center mx-auto mb-4">
          <LogOut className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-normal text-md-on-surface mb-2">Leave meeting?</h3>
        <p className="text-sm text-md-on-surface-variant mb-6">
          You&apos;ll be disconnected from the active session.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-press md-state-layer flex-1 border border-md-outline py-2.5 rounded-md-full text-sm font-medium text-md-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-press flex-1 bg-md-error hover:bg-md-error/90 py-2.5 rounded-md-full text-sm font-medium text-md-on-error"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
