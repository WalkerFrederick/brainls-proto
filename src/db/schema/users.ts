import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 63 }).unique(),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 2048 }),
  status: varchar("status", { length: 31 }).notNull().default("active"),
  personalWorkspaceId: uuid("personal_workspace_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
