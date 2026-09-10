import { z } from "zod";

export const createWebinarSchema = z.object({
  passcode: z.string().min(1, "Passcode is required").max(128),
  isRecording: z.boolean().optional(),
  isTranscription: z.boolean().optional(),
});

export const endWebinarSchema = z.object({
  webinarId: z.string().min(1, "Room ID is required"),
});

export const createRegistrantSchema = z.object({
  firstName: z.string().trim().min(1, "This field is required"),
  lastName: z.string().trim().min(1, "This field is required"),
  email: z.email("Invalid email address").trim(),
});
