"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE_NAME } from "@/server/services/auth/session";
import { config } from "@/server/utils/config";

export interface ApiKeySummary {
  id: string;
  name: string;
  apiKey: string;
  status: "active" | "suspended";
  rateLimit: number;
  burstLimit: number;
  dailyLimit: number;
  createdByName?: string;
  createdByAvatarUrl?: string;
  createdAt: string;
}

function getApiBaseUrl(): string {
  return config.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

/**
 * Calls our own `/api/private/auth/client*` routes on behalf of the logged-in
 * dashboard user, forwarding the session cookie so `userAuthenticationMiddleware`
 * can authenticate the request.
 */
async function apiFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

export async function listMyApiKeysAction(): Promise<{
  success: boolean;
  keys?: ApiKeySummary[];
  error?: string;
}> {
  try {
    const data = await apiFetch("/api/private/auth/client", { method: "GET" });
    return { success: true, keys: data.clients as ApiKeySummary[] };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

export async function createMyApiKeyAction(
  name: string,
  allowedDomains: string[] = [],
): Promise<{
  success: boolean;
  apiKey?: string;
  clientSecret?: string;
  error?: string;
}> {
  try {
    if (!name?.trim()) return { success: false, error: "Name is required" };

    const data = await apiFetch("/api/private/auth/client", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), allowedDomains }),
    });

    revalidatePath("/dashboard");
    return { success: true, apiKey: data.apiKey, clientSecret: data.clientSecret };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

export async function rotateMyApiKeyAction(apiKey: string): Promise<{
  success: boolean;
  apiKey?: string;
  clientSecret?: string;
  error?: string;
}> {
  try {
    const data = await apiFetch("/api/private/auth/client/rotate", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });

    revalidatePath("/dashboard");
    return { success: true, apiKey: data.apiKey, clientSecret: data.clientSecret };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}
