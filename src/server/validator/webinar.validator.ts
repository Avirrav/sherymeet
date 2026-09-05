import { z } from "zod";

export const createWebinarSchema = z.object({
  passcode: z.string().min(1, "Passcode is required").max(128),
  isRecording: z.boolean().optional(),
});
