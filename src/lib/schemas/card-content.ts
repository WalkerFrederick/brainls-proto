import { z } from "zod";
import { stripDisallowedImages } from "@/lib/allowed-hosts";

export const CARD_TYPES = [
  "front_back",
  "multiple_choice",
  "keyboard_shortcut",
  "cloze",
  "image_occlusion",
  "ai_question",
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export const cardTypeEnum = z.enum(CARD_TYPES);

export const MAX_FIELD_LENGTH = 10_000;
export const MAX_CHOICE_LENGTH = 1_000;

const sanitizedField = (label: string) =>
  z
    .string()
    .transform(stripDisallowedImages)
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(
          MAX_FIELD_LENGTH,
          `${label} must be under ${MAX_FIELD_LENGTH.toLocaleString()} characters`,
        ),
    );

export const FrontBackCardSchema = z.object({
  front: sanitizedField("Front side"),
  back: sanitizedField("Back side"),
});

export const MultipleChoiceCardSchema = z.object({
  question: sanitizedField("Question"),
  choices: z
    .array(
      z
        .string()
        .min(1)
        .max(
          MAX_CHOICE_LENGTH,
          `Each choice must be under ${MAX_CHOICE_LENGTH.toLocaleString()} characters`,
        ),
    )
    .min(2, "At least 2 choices required")
    .max(10, "At most 10 choices allowed"),
  correctChoiceIndexes: z
    .array(z.number().int().nonnegative())
    .min(1, "At least 1 correct choice required"),
});

const shortcutObject = z.object({
  key: z.string().min(1, "A key is required"),
  ctrl: z.boolean().default(false),
  shift: z.boolean().default(false),
  alt: z.boolean().default(false),
  meta: z.boolean().default(false),
});

const optionalSanitizedField = (label: string) =>
  z
    .string()
    .transform(stripDisallowedImages)
    .pipe(
      z
        .string()
        .max(
          MAX_FIELD_LENGTH,
          `${label} must be under ${MAX_FIELD_LENGTH.toLocaleString()} characters`,
        ),
    )
    .optional();

export const KeyboardShortcutCardSchema = z.object({
  prompt: sanitizedField("Prompt"),
  shortcut: shortcutObject,
  explanation: optionalSanitizedField("Explanation"),
});

export const ClozeCardSchema = z.object({
  text: sanitizedField("Cloze text"),
  clozeIndex: z.number().int().positive().optional(),
});

export type FrontBackCard = z.infer<typeof FrontBackCardSchema>;
export type MultipleChoiceCard = z.infer<typeof MultipleChoiceCardSchema>;
export type KeyboardShortcutCard = z.infer<typeof KeyboardShortcutCardSchema>;
export type ClozeCard = z.infer<typeof ClozeCardSchema>;

const DEFERRED_TYPES = new Set<CardType>(["image_occlusion", "ai_question"]);

export function getCardContentSchema(cardType: CardType): z.ZodType | null {
  switch (cardType) {
    case "front_back":
      return FrontBackCardSchema;
    case "multiple_choice":
      return MultipleChoiceCardSchema;
    case "keyboard_shortcut":
      return KeyboardShortcutCardSchema;
    case "cloze":
      return ClozeCardSchema;
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
