"use server";

import { getTranscribeUrl } from "@/app/backend/services/media-server-services/transcribe-service";

export async function getTranscribeUrlAction(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = await getTranscribeUrl();
    return { success: true, url };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}
