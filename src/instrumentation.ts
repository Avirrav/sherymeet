/**
 * Runs once when the Next.js server boots (before it accepts requests).
 * Used to fail fast on missing/invalid environment configuration, and to
 * warm + verify the MongoDB and Redis connections up front instead of
 * paying that latency (and finding out about outages) on the first request.
 *
 * dbConnect() and getStore() both cache their connection on `global.*`
 * (see db-connect.ts / store.ts), so calling them here doesn't create a
 * second connection — every request after boot reuses the exact instance
 * warmed here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./server/utils/config");
    validateEnv();

    const { logger } = await import("./server/utils/logger");
    const { dbConnect } = await import("./server/utils/db-connect");
    const { getStore } = await import("./server/utils/store");

    try {
      await dbConnect();
    } catch (err) {
      logger.error("MongoDB not reachable at boot — will retry per-request", err);
    }

    try {
      await getStore().connect();
    } catch (err) {
      logger.error(
        "Redis not reachable at boot — rate limiting and replay protection will fail until it recovers",
        err,
      );
    }
  }
}
