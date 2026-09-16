import { Room, RoomEvent } from "livekit-client";

export function observeChatSetting(room: Room, onChange: (enabled: boolean) => void) {
  const sync = () => onChange(isChatEnabled(room.metadata));
  sync();
  room.on(RoomEvent.RoomMetadataChanged, sync);
  room.on(RoomEvent.Connected, sync);
  room.on(RoomEvent.Reconnected, sync);
  return () => {
    room.off(RoomEvent.RoomMetadataChanged, sync);
    room.off(RoomEvent.Connected, sync);
    room.off(RoomEvent.Reconnected, sync);
  };
}

export function isChatEnabled(metadata?: string): boolean {
  if (!metadata) return true;
  try {
    const value = JSON.parse(metadata);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value.chatEnabled === undefined || value.chatEnabled === true
      : false;
  } catch {
    return false;
  }
}
