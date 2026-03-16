import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const deckDefinitions = pgTable("deck_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }),
  description: varchar("description", { length: 5000 }),
  viewPolicy: varchar("view_policy", { length: 31 }).notNull().default("private"),
  passcodeHash: varchar("passcode_hash", { length: 255 }),
  shareToken: varchar("share_token", { length: 255 }).unique(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  copiedFromDeckDefinitionId: uuid("copied_from_deck_definition_id"),
  linkedDeckDefinitionId: uuid("linked_deck_definition_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  discoveryStatus: varchar("discovery_status", { length: 31 }).default("unlisted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const cardDefinitions = pgTable("card_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  deckDefinitionId: uuid("deck_definition_id")
    .notNull()
    .references(() => deckDefinitions.id),
  cardType: varchar("card_type", { length: 63 }).notNull(),
  status: varchar("status", { length: 31 }).notNull().default("active"),
  contentJson: jsonb("content_json").notNull(),
  parentCardId: uuid("parent_card_id"),
  parentVersionAtGeneration: integer("parent_version_at_generation"),
  version: integer("version").notNull().default(1),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  kind: varchar("kind", { length: 63 }).notNull(),
  storageKey: varchar("storage_key", { length: 1024 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 1024 }),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deckTags = pgTable(
  "deck_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckDefinitionId: uuid("deck_definition_id")
      .notNull()
      .references(() => deckDefinitions.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("deck_tags_deck_tag_idx").on(table.deckDefinitionId, table.tagId)],
);

export const cardTags = pgTable(
  "card_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardDefinitionId: uuid("card_definition_id")
      .notNull()
      .references(() => cardDefinitions.id),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("card_tags_card_tag_idx").on(table.cardDefinitionId, table.tagId)],
);
