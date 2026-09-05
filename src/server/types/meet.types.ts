
export enum MeetType {
  Webinar = "webinar",
  Meeting = "meeting",
}
export enum StatusType {
  Creating = "creating",
  Scheduled = "scheduled",
  Active = "active",
  Ended = "ended",
}

export interface meet {
  roomId: string;
  roomCode: string;
  status: StatusType;
  type: MeetType; 
  startedAt: Date | null;
  endedAt: Date | null;
  passcode: string | null;
  isRecording: boolean;
}