const DICEBEAR_STYLES = [
  "adventurer-neutral",
  "avataaars",
  "bottts",
  "fun-emoji",
  "lorelei",
  "notionists",
  "open-peeps",
  "personas",
  "pixel-art",
] as const;

type DiceBearStyle = (typeof DICEBEAR_STYLES)[number];

export function getDiceBearAvatar(
  seed: string,
  style: DiceBearStyle = "adventurer-neutral",
  size: number = 128,
  backgroundColor: string = "2d2d2d",
): string {
  const encodedSeed = encodeURIComponent(seed || "default");
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodedSeed}&size=${size}&backgroundColor=${backgroundColor}`;
}

export function getAvatarUrl(
  name: string | undefined,
  identity: string | undefined,
  style: DiceBearStyle = "adventurer-neutral",
  backgroundColor: string = "2d2d2d",
): string {
  const seed = name || identity || "anonymous";
  return getDiceBearAvatar(seed, style, 128, backgroundColor);
}
