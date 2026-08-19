import { createRedisConnection } from "@/lib/redis";

/**
 * Entrypoint for the `worker` Compose service (§3, §3.1, §8.1) — runs in a process
 * separate from `app`, dedicated to BullMQ queues (correction de copie, génération de
 * quiz, notifications SMS/WhatsApp, rappel de renouvellement, rétention/anonymisation).
 * Phase 0 only wires the Redis connection lifecycle; queue definitions and processors
 * land in Phase 1+ alongside the features that enqueue them.
 */
async function main() {
  const connection = createRedisConnection();

  connection.on("connect", () => {
    console.log("[worker] connected to Redis");
  });
  connection.on("error", (err) => {
    console.error("[worker] Redis connection error", err);
  });

  const shutdown = async () => {
    console.log("[worker] shutting down");
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal startup error", err);
  process.exit(1);
});
