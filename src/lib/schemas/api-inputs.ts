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

export const CreateWorkspaceSchema = z.object({
  name: nameField,
  description: z.string().trim().max(2048).optional(),
  kind: z.enum(["personal", "shared"]).default("shared"),
});

export const UpdateWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: nameField.optional(),
  description: z.string().trim().max(2048).optional(),
});

export const InviteWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email("Valid email required"),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

export const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "editor", "viewer"]),
});

export const CreateDeckSchema = z.object({
  workspaceId: z.string().uuid(),
  title: titleField,
  description: z.string().trim().max(5000).optional(),
});

const viewPolicyEnum = z.enum(["private", "workspace", "link", "public"]);
const usePolicyEnum = z.enum(["none", "invite_only", "passcode", "open"]);
const forkPolicyEnum = z.enum([
  "none",
  "owner_only",
  "workspace_editors",
  "workspace_members",
  "any_user",
]);

export const UpdateDeckSchema = z.object({
  deckId: z.string().uuid(),
  title: titleField.optional(),
  description: z.string().trim().max(5000).optional(),
  viewPolicy: viewPolicyEnum.optional(),
  usePolicy: usePolicyEnum.optional(),
  forkPolicy: forkPolicyEnum.optional(),
});

export const CreateCardSchema = z.object({
  deckDefinitionId: z.string().uuid(),
  cardType: cardTypeEnum,
  contentJson: z.record(z.string(), z.unknown()),
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
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
export type InviteWorkspaceMemberInput = z.infer<typeof InviteWorkspaceMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
