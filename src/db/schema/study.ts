import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { deckDefinitions, cardDefinitions } from "./content";

export const userDecks = pgTable("user_decks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  deckDefinitionId: uuid("deck_definition_id")
    .notNull()
    .references(() => deckDefinitions.id),
  srsConfigJson: jsonb("srs_config_json"),
  srsConfigVersion: integer("srs_config_version").notNull().default(1),
  lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const userCardStates = pgTable("user_card_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  userDeckId: uuid("user_deck_id")
    .notNull()
    .references(() => userDecks.id),
  cardDefinitionId: uuid("card_definition_id")
    .notNull()
    .references(() => cardDefinitions.id),
  srsState: varchar("srs_state", { length: 31 }).notNull().default("new"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  intervalDays: integer("interval_days"),
  easeFactor: numeric("ease_factor", { precision: 5, scale: 3 }),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  srsVersionAtLastReview: integer("srs_version_at_last_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userDeckId: uuid("user_deck_id")
    .notNull()
    .references(() => userDecks.id),
  userCardStateId: uuid("user_card_state_id")
    .notNull()
    .references(() => userCardStates.id),
  cardDefinitionId: uuid("card_definition_id")
    .notNull()
    .references(() => cardDefinitions.id),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  rating: varchar("rating", { length: 31 }).notNull(),
  wasCorrect: boolean("was_correct"),
  responseMs: integer("response_ms"),
  srsStateBefore: varchar("srs_state_before", { length: 31 }),
  srsStateAfter: varchar("srs_state_after", { length: 31 }),
  intervalDaysBefore: integer("interval_days_before"),
  intervalDaysAfter: integer("interval_days_after"),
  easeFactorBefore: numeric("ease_factor_before", { precision: 5, scale: 3 }),
  easeFactorAfter: numeric("ease_factor_after", { precision: 5, scale: 3 }),
  srsVersionUsed: integer("srs_version_used"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
