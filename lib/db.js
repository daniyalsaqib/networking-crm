import { Pool } from "pg";

// Reuse the pool across hot reloads in dev instead of opening a new one per request.
const globalForPg = globalThis;

function getDbSslConfig() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return false;

  try {
    const parsed = new URL(dbUrl);
    const hostname = (parsed.hostname || "").toLowerCase();

    // Only pure loopback addresses on the local machine bypass SSL
    const isLoopback =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    if (isLoopback) {
      return false;
    }

    // Verify the deployed database TLS certificate chain against trusted system root CAs
    return {
      rejectUnauthorized: true,
    };
  } catch {
    return {
      rejectUnauthorized: true,
    };
  }
}

const pool =
  globalForPg._pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getDbSslConfig(),
    max: 5,                          // Conservative pool limit suited for serverless & Neon free tier
    idleTimeoutMillis: 10_000,       // Close idle connections after 10s
    connectionTimeoutMillis: 5_000,  // Fast timeout if connection cannot be established
  });

if (!globalForPg._pgPool) {
  globalForPg._pgPool = pool;
}

export default pool;
