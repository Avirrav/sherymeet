// Instrumentation setup for the Next.js server, including environment validation and initial connection to MongoDB and Redis.
// Run once at server boot
export async function register() {
  // check if running in a Node.js environment
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and validate environment variables, and set up initial connections to MongoDB and Redis.
    const { validateEnv } = await import("./server/utils/config");
    validateEnv();

    // Import and set up the logger for logging any issues during boot
    const { logger } = await import("./server/utils/logger");
    const { dbConnect } = await import("./server/utils/db-connect");
    const { getStore } = await import("./server/utils/store");

    // Attempt to connect to MongoDB and Redis, logging any errors encountered during boot
    try {
      await dbConnect();
    } catch (err) {
      logger.error("MongoDB not reachable at boot — will retry per-request", err);
    }

    // Attempt to connect to Redis, logging any errors encountered during boot
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
