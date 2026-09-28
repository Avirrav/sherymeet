// Instrumentation setup for the Next.js server, including environment validation and initial connection to MongoDB and Redis.
// Run once at server boot
export async function register() {
  // check if running in a Node.js environment
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and validate environment variables, and set up initial connections to MongoDB and Redis.
    const { validateEnv } = await import("./server/utils/config");
    validateEnv();

    // Import modules in parallel for faster boot
    const [{ logger }, { dbConnect }, { getStore }] = await Promise.all([
      import("./server/utils/logger"),
      import("./server/utils/db-connect"),
      import("./server/utils/store"),
    ]);

    // Attempt to connect to MongoDB and Redis in parallel
    const results = await Promise.allSettled([dbConnect(), getStore().connect()]);

    if (results[0].status === "rejected") {
      logger.error("MongoDB not reachable at boot — will retry per-request", results[0].reason);
    }
    if (results[1].status === "rejected") {
      logger.error(
        "Redis not reachable at boot — rate limiting and replay protection will fail until it recovers",
        results[1].reason,
      );
    }
  }
}
