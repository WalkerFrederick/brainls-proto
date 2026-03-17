import { pgTable, uuid, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const folders = pgTable("folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  description: varchar("description", { length: 2048 }),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const folderSettings = pgTable("folder_settings", {
  folderId: uuid("folder_id")
    .primaryKey()
    .references(() => folders.id),
  allowPublicPublishing: boolean("allow_public_publishing").notNull().default(false),
  allowMemberInvites: boolean("allow_member_invites").notNull().default(true),
  allowViewerDeckUse: boolean("allow_viewer_deck_use").notNull().default(true),
  settingsJson: jsonb("settings_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const folderMembers = pgTable("folder_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  folderId: uuid("folder_id")
    .notNull()
    .references(() => folders.id),
  userId: uuid("user_id").references(() => users.id),
  invitedEmail: varchar("invited_email", { length: 255 }),
  role: varchar("role", { length: 31 }).notNull().default("viewer"),
  status: varchar("status", { length: 31 }).notNull().default("invited"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
