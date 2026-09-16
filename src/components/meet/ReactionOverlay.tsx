"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingReaction } from "./reactions";
import styles from "./ReactionOverlay.module.css";

interface FloatingReaction extends MeetingReaction {
  id: number;
  expiresAt: number;
}

export function useReactionDisplay() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const sequence = useRef(0);
  const showReaction = useCallback((reaction: MeetingReaction) => {
    const item = { ...reaction, id: ++sequence.current, expiresAt: Date.now() + 4000 };
    setReactions((current) => [
      ...current.filter((entry) => entry.expiresAt > Date.now()).slice(-11),
      item,
    ]);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setReactions((current) =>
        current.some((item) => item.expiresAt <= Date.now())
          ? current.filter((item) => item.expiresAt > Date.now())
          : current,
      );
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return { reactions, showReaction };
}

export default function ReactionOverlay({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-30" aria-live="off">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className={styles.reaction}
          style={{ bottom: `${7 + (reaction.id % 3) * 1.25}rem` }}
          role="img"
          aria-label={`${reaction.senderName} reacted ${reaction.emoji}`}
        >
          <span className="text-4xl" aria-hidden="true">
            {reaction.emoji}
          </span>
          <span className="max-w-28 truncate rounded-full bg-md-surface-container-high/90 px-2 py-1 text-xs text-md-on-surface">
            {reaction.senderName}
          </span>
        </div>
      ))}
    </div>
  );
}
