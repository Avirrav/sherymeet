import { z } from "zod";

const roomIdSchema = z
  .string()
  .min(1, "Room ID is required")
  .max(64)
  .regex(/^[a-z0-9-]+$/i, "Room ID contains invalid characters");

export const startSessionSchema = z.object({
  roomId: roomIdSchema,
  token: z.string().min(1, "Token is required"),
});

export const endSessionSchema = z.object({
  roomId: roomIdSchema,
  token: z.string().min(1, "Token is required"),
});

export const verifyTokenSchema = z.object({
  roomId: roomIdSchema,
  token: z.string().min(1, "Token is required"),
});
