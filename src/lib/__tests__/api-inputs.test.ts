import { describe, it, expect } from "vitest";
import {
  CreateWorkspaceSchema,
  CreateDeckSchema,
  CreateCardSchema,
  SubmitReviewSchema,
  InviteWorkspaceMemberSchema,
  UpdateMemberRoleSchema,
} from "@/lib/schemas/api-inputs";

describe("CreateWorkspaceSchema", () => {
  it("accepts valid workspace", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "My Workspace" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects single-character name", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects name with no alphanumeric characters", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "---" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from valid name", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "  My Workspace  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Workspace");
    }
  });
});

describe("CreateDeckSchema", () => {
  it("accepts valid deck", () => {
    const result = CreateDeckSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Biology 101",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid workspaceId", () => {
    const result = CreateDeckSchema.safeParse({
      workspaceId: "not-a-uuid",
      title: "Biology 101",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only title", () => {
    const result = CreateDeckSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      title: " ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title with no alphanumeric characters", () => {
    const result = CreateDeckSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      title: "!!??",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateCardSchema", () => {
  it("accepts valid card input", () => {
    const result = CreateCardSchema.safeParse({
      deckDefinitionId: "550e8400-e29b-41d4-a716-446655440000",
      cardType: "front_back",
      contentJson: { front: "Q", back: "A" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid card type", () => {
    const result = CreateCardSchema.safeParse({
      deckDefinitionId: "550e8400-e29b-41d4-a716-446655440000",
      cardType: "nonexistent",
      contentJson: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("SubmitReviewSchema", () => {
  it("accepts valid review", () => {
    const result = SubmitReviewSchema.safeParse({
      userCardStateId: "550e8400-e29b-41d4-a716-446655440000",
      rating: "good",
      idempotencyKey: "abc-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid rating", () => {
    const result = SubmitReviewSchema.safeParse({
      userCardStateId: "550e8400-e29b-41d4-a716-446655440000",
      rating: "perfect",
      idempotencyKey: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("InviteWorkspaceMemberSchema", () => {
  it("accepts valid invite", () => {
    const result = InviteWorkspaceMemberSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      role: "editor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = InviteWorkspaceMemberSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateMemberRoleSchema", () => {
  it("rejects owner role assignment", () => {
    const result = UpdateMemberRoleSchema.safeParse({
      memberId: "550e8400-e29b-41d4-a716-446655440000",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });
});
