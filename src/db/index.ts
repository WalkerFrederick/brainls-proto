import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

type Database = PostgresJsDatabase<typeof schema>;

function createDb(): Database {
  if (process.env.NODE_ENV === "production") {
    const pool = new Pool({ connectionString });
    return drizzleNeon(pool, { schema }) as unknown as Database;
  }

  const globalForDb = globalThis as unknown as {
    _pgClient?: ReturnType<typeof postgres>;
  };
  if (!globalForDb._pgClient) {
    globalForDb._pgClient = postgres(connectionString);
  }
  return drizzlePg(globalForDb._pgClient, { schema });
}

export const db = createDb();
