import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function reset() {
  const client = postgres(DATABASE_URL!);

  console.log("Dropping all tables (public schema)...");
  await client.unsafe(`DROP SCHEMA public CASCADE`);
  await client.unsafe(`CREATE SCHEMA public`);
  console.log("Schema reset complete.");

  await client.end();
}

reset().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});
