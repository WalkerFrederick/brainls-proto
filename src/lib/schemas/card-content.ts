import { z } from "zod";

export const CARD_TYPES = [
  "front_back",
  "multiple_choice",
  "cloze",
  "image_occlusion",
  "ai_question",
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export const cardTypeEnum = z.enum(CARD_TYPES);

export const FrontBackCardSchema = z.object({
  front: z.string().min(1, "Front side is required"),
  back: z.string().min(1, "Back side is required"),
});

export const MultipleChoiceCardSchema = z.object({
  question: z.string().min(1, "Question is required"),
  choices: z
    .array(z.string().min(1))
    .min(2, "At least 2 choices required")
    .max(10, "At most 10 choices allowed"),
  correctChoiceIndexes: z
    .array(z.number().int().nonnegative())
    .min(1, "At least 1 correct choice required"),
});

export type FrontBackCard = z.infer<typeof FrontBackCardSchema>;
export type MultipleChoiceCard = z.infer<typeof MultipleChoiceCardSchema>;

const DEFERRED_TYPES = new Set<CardType>(["cloze", "image_occlusion", "ai_question"]);

export function getCardContentSchema(cardType: CardType): z.ZodType | null {
  switch (cardType) {
    case "front_back":
      return FrontBackCardSchema;
    case "multiple_choice":
      return MultipleChoiceCardSchema;
    default:
      if (DEFERRED_TYPES.has(cardType)) {
        return null;
      }
      throw new Error(`Unknown card type: ${cardType}`);
  }
}

export function validateCardContent(
  cardType: CardType,
  content: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
  const schema = getCardContentSchema(cardType);
  if (!schema) {
    return { success: false, error: `Card type "${cardType}" is not yet supported` };
  }
  const result = schema.safeParse(content);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => i.message).join("; ") };
  }
  return { success: true, data: result.data };
}
