import { pgTable, uuid, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  description: varchar("description", { length: 2048 }),
  avatarUrl: varchar("avatar_url", { length: 2048 }),
  kind: varchar("kind", { length: 31 }).notNull().default("personal"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id),
  allowPublicPublishing: boolean("allow_public_publishing").notNull().default(false),
  allowMemberInvites: boolean("allow_member_invites").notNull().default(true),
  allowViewerDeckUse: boolean("allow_viewer_deck_use").notNull().default(true),
  settingsJson: jsonb("settings_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: varchar("role", { length: 31 }).notNull().default("viewer"),
  status: varchar("status", { length: 31 }).notNull().default("invited"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
