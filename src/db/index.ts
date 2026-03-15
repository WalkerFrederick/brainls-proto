import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const isProduction = process.env.NODE_ENV === "production";

function createDb() {
  if (isProduction) {
    return drizzleHttp(connectionString, { schema });
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
