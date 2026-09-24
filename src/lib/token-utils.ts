export interface TokenUserMetadata {
  name: string;
  email: string;
  role: string;
}

export interface DecodedTokenPayload {
  sub?: string;
  name?: string;
  metadata?: string;
  video?: {
    room?: string;
    roomJoin?: boolean;
    roomAdmin?: boolean;
  };
  iat?: number;
  exp?: number;
}

export function extractUserFromToken(token: string): TokenUserMetadata | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));

    let name = decoded.name || "";
    let email = "";
    let role = "";

    if (decoded.metadata) {
      try {
        const meta =
          typeof decoded.metadata === "string" ? JSON.parse(decoded.metadata) : decoded.metadata;

        if (meta.participant) {
          name = meta.participant.name || name;
          email = meta.participant.email || "";
          role = meta.participant.role || "";
        }
      } catch {
        // Metadata parsing failed, use defaults
      }
    }

    return { name, email, role };
  } catch {
    console.error("Failed to decode token");
    return null;
  }
}
