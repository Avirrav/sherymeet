export const REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "👏", label: "Applause" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "😮", label: "Surprised" },
] as const;

export type ReactionEmoji = (typeof REACTIONS)[number]["emoji"];
export interface MeetingReaction {
  emoji: ReactionEmoji;
  senderName: string;
  senderIdentity: string;
}

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return REACTIONS.some(({ emoji }) => emoji === value);
}
