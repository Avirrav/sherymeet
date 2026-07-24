import { z } from "zod";
import { ApiError } from "../utils/api-helper";

/**
 * Zod schemas for every meet-related route body, plus a shared parse helper.
 * Handlers call parseBody() so malformed input consistently becomes a 400
 * with field-level details instead of ad-hoc manual checks.
 */

const roomIdSchema = z
  .string()
  .min(1, "Room ID is required")
  .max(64)
  .regex(/^[a-z0-9-]+$/i, "Room ID contains invalid characters");

// Display names end up in LiveKit identities and UI; keep them short and
// strip control characters.
const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80)
  .regex(/^[^\x00-\x1f\x7f]+$/, "Name contains invalid characters");

export const createMeetSchema = z.object({
  passcode: z.string().min(1, "Passcode is required").max(128),
  type: z.enum(["webinar", "meet"]).optional(),
  isRecording: z.boolean().optional(),
});

export const createStartUrlSchema = z.object({
  roomId: roomIdSchema,
  passcode: z.string().max(128).optional(),
});

export const joinAsUserSchema = z.object({
  roomId: roomIdSchema,
  passcode: z.string().max(128).optional(),
  participantData: z
    .object({
      name: displayNameSchema.optional(),
      // Accepted for backwards compatibility with older clients that send
      // `username` instead of `name`.
      username: displayNameSchema.optional(),
      role: z.string().optional(),
    })
    .refine((p) => p.name || p.username, {
      message: "Participant name is required",
      path: ["name"],
    }),
});

export const endMeetSchema = z.object({
  roomId: roomIdSchema,
});

export const serverRoomTokenSchema = z.object({
  roomId: roomIdSchema,
  token: z.string().min(1, "Token is required"),
});

export const verifyTokenSchema = z.object({
  roomId: roomIdSchema,
  token: z.string().min(1, "Token is required"),
  password: z.string().max(128).optional(),
});

/**
 * Parses `data` against `schema`; throws an ApiError(400) carrying
 * field-level issues when validation fails.
 */
export function parseBody<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(
      "Invalid request body",
      400,
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/**
 * Reads and parses a JSON request body, treating unparseable JSON as a 400
 * instead of an unhandled exception.
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON", 400);
  }
  return parseBody(schema, data);
}
