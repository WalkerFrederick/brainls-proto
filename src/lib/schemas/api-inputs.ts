import { z } from "zod";
import { cardTypeEnum } from "./card-content";

const nameField = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(255)
  .regex(/[a-zA-Z0-9]/, "Name must contain at least one letter or number");

const titleField = z
  .string()
  .trim()
  .min(2, "Title must be at least 2 characters")
  .max(500)
  .regex(/[a-zA-Z0-9]/, "Title must contain at least one letter or number");

export const CreateFolderSchema = z.object({
  name: nameField,
  description: z.string().trim().max(2048).optional(),
});

export const UpdateFolderSchema = z.object({
  folderId: z.string().uuid(),
  name: nameField.optional(),
  description: z.string().trim().max(2048).optional(),
});

export const InviteFolderMemberSchema = z.object({
  folderId: z.string().uuid(),
  email: z.string().email("Valid email required"),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

export const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "editor", "viewer"]),
});

export const CreateDeckSchema = z.object({
  folderId: z.string().uuid(),
  title: titleField,
  description: z.string().trim().max(5000).optional(),
});

const viewPolicyEnum = z.enum(["private", "folder", "link", "public"]);

export const UpdateDeckSchema = z.object({
  deckId: z.string().uuid(),
  title: titleField.optional(),
  description: z.string().trim().max(5000).optional(),
  viewPolicy: viewPolicyEnum.optional(),
});

export const CreateCardSchema = z.object({
  deckDefinitionId: z.string().uuid(),
  cardType: cardTypeEnum,
  contentJson: z.record(z.string(), z.unknown()),
  createReverse: z.boolean().optional(),
});

export const UpdateCardSchema = z.object({
  cardId: z.string().uuid(),
  contentJson: z.record(z.string(), z.unknown()),
});

export const SubmitReviewSchema = z.object({
  userCardStateId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
  responseMs: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().min(1),
  skipSrsUpdate: z.boolean().optional(),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;
export type InviteFolderMemberInput = z.infer<typeof InviteFolderMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

// ── Tags ──

const tagNameField = z
  .string()
  .trim()
  .min(1, "Tag must be at least 1 character")
  .max(50, "Tag must be at most 50 characters")
  .regex(/^[a-zA-Z0-9\s-]+$/, "Tags can only contain letters, numbers, spaces, and hyphens")
  .transform((s) => s.toLowerCase().replace(/\s+/g, "-"));

const tagNamesArray = z.array(tagNameField).max(10, "Maximum 10 tags");

export const SetDeckTagsSchema = z.object({
  deckDefinitionId: z.string().uuid(),
  tagNames: tagNamesArray,
});

export const SetCardTagsSchema = z.object({
  cardDefinitionId: z.string().uuid(),
  tagNames: tagNamesArray,
});

export const SearchTagsSchema = z.object({
  query: z.string().trim().max(100).default(""),
});

export const SuggestCardTagsSchema = z.object({
  deckDefinitionId: z.string().uuid(),
  cardContent: z.string().trim().max(10_000).optional(),
  cardType: z.string().max(50).optional(),
  existingCardTags: z.array(z.string()).max(10).optional(),
});

export type SetDeckTagsInput = z.infer<typeof SetDeckTagsSchema>;
export type SetCardTagsInput = z.infer<typeof SetCardTagsSchema>;
export type SearchTagsInput = z.infer<typeof SearchTagsSchema>;
export type SuggestCardTagsInput = z.infer<typeof SuggestCardTagsSchema>;

// ── Custom Study ──

export const CustomStudySchema = z.object({
  tagNames: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((s) => s.toLowerCase().replace(/\s+/g, "-")),
    )
    .min(1, "Select at least one tag")
    .max(20),
});
