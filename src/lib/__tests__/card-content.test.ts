import { describe, it, expect } from "vitest";
import {
  FrontBackCardSchema,
  MultipleChoiceCardSchema,
  getCardContentSchema,
  validateCardContent,
} from "@/lib/schemas/card-content";

describe("FrontBackCardSchema", () => {
  it("accepts valid front/back", () => {
    const result = FrontBackCardSchema.safeParse({ front: "Hello", back: "World" });
    expect(result.success).toBe(true);
  });

  it("rejects empty front", () => {
    const result = FrontBackCardSchema.safeParse({ front: "", back: "World" });
    expect(result.success).toBe(false);
  });

  it("rejects missing back", () => {
    const result = FrontBackCardSchema.safeParse({ front: "Hello" });
    expect(result.success).toBe(false);
  });
});

describe("MultipleChoiceCardSchema", () => {
  it("accepts valid multiple choice", () => {
    const result = MultipleChoiceCardSchema.safeParse({
      question: "What is 2+2?",
      choices: ["3", "4", "5"],
      correctChoiceIndexes: [1],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 2 choices", () => {
    const result = MultipleChoiceCardSchema.safeParse({
      question: "Q",
      choices: ["Only one"],
      correctChoiceIndexes: [0],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty correctChoiceIndexes", () => {
    const result = MultipleChoiceCardSchema.safeParse({
      question: "Q",
      choices: ["A", "B"],
      correctChoiceIndexes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("getCardContentSchema", () => {
  it("returns FrontBackCardSchema for front_back", () => {
    expect(getCardContentSchema("front_back")).toBe(FrontBackCardSchema);
  });

  it("returns MultipleChoiceCardSchema for multiple_choice", () => {
    expect(getCardContentSchema("multiple_choice")).toBe(MultipleChoiceCardSchema);
  });

  it("returns null for deferred types", () => {
    expect(getCardContentSchema("cloze")).toBeNull();
    expect(getCardContentSchema("image_occlusion")).toBeNull();
    expect(getCardContentSchema("ai_question")).toBeNull();
  });
});

describe("validateCardContent", () => {
  it("validates front_back content", () => {
    const result = validateCardContent("front_back", { front: "Q", back: "A" });
    expect(result.success).toBe(true);
  });

  it("returns error for invalid front_back content", () => {
    const result = validateCardContent("front_back", { front: "" });
    expect(result.success).toBe(false);
  });

  it("returns error for deferred card type", () => {
    const result = validateCardContent("cloze", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not yet supported");
    }
  });
});
