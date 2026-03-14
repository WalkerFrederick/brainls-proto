import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
    generateId: () => crypto.randomUUID(),
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
      status: { type: "string", required: false, defaultValue: "active" },
      personalWorkspaceId: { type: "string", required: false },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
