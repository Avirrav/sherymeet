/**
 * Provisions the single API client this deployment serves requests for.
 *
 * Sherymeet is single-tenant: there is no login, no dashboard, no platform
 * user — the one HMAC key/secret pair created here is the entire identity
 * layer for the /api/v1/client API (see server/middleware/authentication-middleware.ts
 * and server/services/auth/api-client.ts, which this script calls directly
 * instead of going through an HTTP route or a logged-in session).
 *
 * Run once per deployment (or again to mint an additional client):
 *   pnpm create-client -- --name "My Backend" [--domain example.com] [--allow-recording]
 *
 * The printed `clientSecret` is shown ONLY ONCE — it's stored encrypted
 * (server/services/auth/keyencryption.ts) and cannot be recovered, only
 * rotated (ApiClientService.rotateSecret, not yet wired to this script).
 */
import mongoose from "mongoose";
import { dbConnect } from "../src/server/utils/db-connect";
import { ApiClientService } from "../src/server/services/auth/api-client";

function parseArgs(argv: string[]) {
  const args: { name?: string; domains: string[]; allowRecording: boolean } = {
    domains: [],
    allowRecording: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--name") {
      args.name = argv[++i];
    } else if (arg === "--domain") {
      const value = argv[++i];
      if (value) args.domains.push(value);
    } else if (arg === "--allow-recording") {
      args.allowRecording = true;
    }
  }
  return args;
}

async function main() {
  const { name, domains, allowRecording } = parseArgs(process.argv.slice(2));

  if (!name) {
    console.error(
      'Usage: pnpm create-client -- --name "My Backend" [--domain example.com ...] [--allow-recording]',
    );
    process.exit(1);
  }

  await dbConnect();

  // No `creator` — single-tenant clients aren't owned by a platform user.
  const { client, plaintextSecret } = await ApiClientService.createApiClient(
    name,
    domains,
    undefined,
    allowRecording,
  );

  console.log("\nAPI client created. Store these now — the secret is shown only once:\n");
  console.log(`  SHERYMEET_API_KEY=${client.apiKey}`);
  console.log(`  SHERYMEET_CLIENT_SECRET=${plaintextSecret}\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to create API client:", err);
  process.exit(1);
});
