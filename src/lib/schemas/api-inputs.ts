import { z } from "zod";
import { cardTypeEnum } from "./card-content";

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2048).optional(),
  kind: z.enum(["personal", "shared"]).default("shared"),
});

export const UpdateWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).optional(),
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
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
});

export const UpdateDeckSchema = z.object({
  deckId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
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
