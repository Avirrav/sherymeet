"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { REACTIONS, type ReactionEmoji } from "./reactions";

export default function ReactionControls({
  sendReaction,
  disabled,
}: {
  sendReaction: (emoji: ReactionEmoji) => Promise<void>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-label="Reactions"
        aria-expanded={open && !disabled}
        title="Reactions"
        className="control-btn p-3.5 rounded-full hover:bg-md-surface-container-highest text-md-on-surface-variant disabled:opacity-30 disabled:pointer-events-none"
      >
        <Smile className="w-5 h-5" />
      </button>
      {open && !disabled && (
        <div
          role="group"
          aria-label="Choose a reaction"
          className="absolute bottom-full left-0 mb-3 flex gap-1 p-2 rounded-2xl border border-md-outline-variant bg-md-surface-container-high shadow-lg"
        >
          {REACTIONS.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              aria-label={label}
              title={label}
              disabled={sending}
              onClick={async () => {
                setSending(true);
                setOpen(false);
                trigger.current?.focus();
                try {
                  await sendReaction(emoji);
                } finally {
                  setSending(false);
                }
              }}
              className="p-2 text-2xl rounded-xl hover:bg-md-surface-container-highest focus-visible:outline-2 focus-visible:outline-md-primary disabled:opacity-40"
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
