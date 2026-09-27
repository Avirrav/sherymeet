/**
 * SheryMeet Embed SDK
 *
 * Embed SheryMeet video conferences in any website
 *
 * @example
 * ```typescript
 * import { SheryMeet } from 'sherymeet-sdk';
 *
 * const meet = new SheryMeet({
 *   container: '#meeting',
 *   baseUrl: 'https://meet.example.com'
 * });
 *
 * await meet.join('room-123', {
 *   token: 'your-jwt-token',
 *   username: 'John Doe'
 * });
 *
 * meet.on('participant-joined', (p) => {
 *   console.log(`${p.name} joined the meeting`);
 * });
 * ```
 *
 * @packageDocumentation
 */

export { SheryMeet, default } from "./shery-meet";

export type {
  SheryMeetOptions,
  JoinOptions,
  EmbedParticipant,
  EmbedState,
  ChatMessage,
  LayoutMode,
  EventMap,
  EventName,
  EventCallback,
} from "./types";
