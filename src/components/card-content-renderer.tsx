import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ShortcutDisplay } from "@/components/shortcut-display";
import { CardAnswerReveal } from "@/components/card-answer-reveal";
import { renderClozePreview, getUniqueClozeIndices } from "@/lib/cloze";

interface CardContentRendererProps {
  cardType: string;
  contentJson: Record<string, unknown>;
}

export function CardContentRenderer({ cardType, contentJson }: CardContentRendererProps) {
  if (cardType === "front_back") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Front</p>
          <MarkdownRenderer content={String(contentJson.front ?? "")} className="mt-1" />
        </div>
        <CardAnswerReveal>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Back</p>
            <MarkdownRenderer content={String(contentJson.back ?? "")} className="mt-1" />
          </div>
        </CardAnswerReveal>
      </div>
    );
  }

  if (cardType === "multiple_choice") {
    return (
      <div>
        <MarkdownRenderer content={String(contentJson.question ?? "")} />
        <CardAnswerReveal>
          <ul className="mt-2 space-y-1">
            {(contentJson.choices as string[] | undefined)?.map((choice, i) => {
              const correct = (contentJson.correctChoiceIndexes as number[])?.includes(i);
              return (
                <li
                  key={i}
                  className={correct ? "font-semibold text-green-600" : "text-muted-foreground"}
                >
                  {correct ? "✓" : "○"} {choice}
                </li>
              );
            })}
          </ul>
        </CardAnswerReveal>
      </div>
    );
  }

  if (cardType === "cloze") {
    const text = String(contentJson.text ?? "");
    const indices = getUniqueClozeIndices(text);
    return (
      <div className="space-y-2">
        <MarkdownRenderer content={renderClozePreview(text)} />
        <p className="text-xs text-muted-foreground">
          {indices.length} cloze card{indices.length !== 1 ? "s" : ""} (
          {indices.map((i) => `c${i}`).join(", ")})
        </p>
      </div>
    );
  }

  if (cardType === "keyboard_shortcut") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Prompt</p>
        <MarkdownRenderer content={String(contentJson.prompt ?? "")} />
        <CardAnswerReveal>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Shortcut</p>
            {contentJson.shortcut ? (
              <ShortcutDisplay
                shortcut={
                  contentJson.shortcut as {
                    key: string;
                    ctrl: boolean;
                    shift: boolean;
                    alt: boolean;
                    meta: boolean;
                  }
                }
              />
            ) : null}
            {contentJson.explanation ? (
              <>
                <p className="text-xs font-medium text-muted-foreground mt-2">Explanation</p>
                <MarkdownRenderer content={String(contentJson.explanation)} className="text-sm" />
              </>
            ) : null}
          </div>
        </CardAnswerReveal>
      </div>
    );
  }

  return (
    <p className="text-sm italic text-muted-foreground">
      Unsupported card type: {cardType.replace(/_/g, " ")}
    </p>
  );
}
