"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning";
}

export default function ConfirmModal({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "warning",
}: ConfirmModalProps) {
  const isDanger = variant === "danger";

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-md-surface-container-high border border-md-outline-variant/50 p-6 rounded-md-xl max-w-sm w-full mx-4 text-center animate-scale-in">
        <div
          className={`w-12 h-12 ${
            isDanger
              ? "bg-md-error-container text-md-on-error-container"
              : "bg-yellow-500/20 text-yellow-500"
          } rounded-md-lg flex items-center justify-center mx-auto mb-4`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-normal text-md-on-surface mb-2">{title}</h3>
        <p className="text-sm text-md-on-surface-variant mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-press md-state-layer flex-1 border border-md-outline py-2.5 rounded-md-full text-sm font-medium text-md-primary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn-press flex-1 ${
              isDanger
                ? "bg-md-error hover:bg-md-error/90 text-md-on-error"
                : "bg-yellow-500 hover:bg-yellow-600 text-white"
            } py-2.5 rounded-md-full text-sm font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
