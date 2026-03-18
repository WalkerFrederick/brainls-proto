"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listCards } from "@/actions/card";
import { getCardStudyStates } from "@/actions/study";
import { DeckCardItem } from "@/components/deck-card-item";
import { EditCardDialog } from "@/components/edit-card-dialog";

interface LoadMoreCardsProps {
  deckId: string;
  initialOffset: number;
  totalCount: number;
  tagFilter?: string;
  isEditor: boolean;
  isLinked: boolean;
}

export function LoadMoreCards({
  deckId,
  initialOffset,
  totalCount,
  tagFilter,
  isEditor,
  isLinked,
}: LoadMoreCardsProps) {
  const PAGE_SIZE = 50;
  const [offset, setOffset] = useState(initialOffset);
  const [cards, setCards] = useState<
    Array<{
      id: string;
      cardType: string;
      contentJson: unknown;
      tags: string[];
      version: number;
    }>
  >([]);
  const [studyStateMap, setStudyStateMap] = useState<
    Map<string, { srsState: string; dueAt: Date | null }>
  >(new Map());
  const [childStudyStateMap, setChildStudyStateMap] = useState<
    Map<string, { clozeIndex: number; srsState: string; dueAt: Date | null }[]>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  const remaining = totalCount - offset - cards.length;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const [cardsResult, statesResult] = await Promise.all([
        listCards(deckId, { tag: tagFilter, limit: PAGE_SIZE, offset }),
        getCardStudyStates(deckId),
      ]);

      if (cardsResult.success) {
        const newCards = cardsResult.data.cards;
        setCards((prev) => [...prev, ...newCards]);
        setOffset((prev) => prev + newCards.length);

        if (newCards.length < PAGE_SIZE) {
          setAllLoaded(true);
        }
      }

      if (statesResult.success) {
        const newStudyMap = new Map(studyStateMap);
        const newChildMap = new Map(childStudyStateMap);

        for (const s of statesResult.data) {
          newStudyMap.set(s.cardDefinitionId, { srsState: s.srsState, dueAt: s.dueAt });
          if (s.parentCardId) {
            const cj = s.contentJson as Record<string, unknown>;
            const clozeIndex = Number(cj.clozeIndex ?? 0);
            const existing = newChildMap.get(s.parentCardId) ?? [];
            if (!existing.some((e) => e.clozeIndex === clozeIndex)) {
              existing.push({ clozeIndex, srsState: s.srsState, dueAt: s.dueAt });
              newChildMap.set(
                s.parentCardId,
                existing.sort((a, b) => a.clozeIndex - b.clozeIndex),
              );
            }
          }
        }

        setStudyStateMap(newStudyMap);
        setChildStudyStateMap(newChildMap);
      }
    } finally {
      setLoading(false);
    }
  }, [deckId, tagFilter, offset, studyStateMap, childStudyStateMap]);

  return (
    <>
      {cards.map((card) => {
        const content = card.contentJson as Record<string, unknown>;
        const studyState = studyStateMap.get(card.id);
        return (
          <DeckCardItem
            key={card.id}
            cardId={card.id}
            cardType={card.cardType}
            contentJson={content}
            tags={card.tags}
            version={card.version}
            srsState={studyState?.srsState}
            dueAt={studyState?.dueAt ?? undefined}
            childStudyStates={childStudyStateMap.get(card.id)}
            editSlot={
              isEditor && !isLinked ? (
                <EditCardDialog
                  cardId={card.id}
                  cardType={card.cardType}
                  contentJson={content}
                  deckDefinitionId={deckId}
                  initialTags={card.tags}
                />
              ) : undefined
            }
          />
        );
      })}
      {!allLoaded && remaining > 0 && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load more (${remaining > 0 ? remaining : "..."} remaining)`
            )}
          </Button>
        </div>
      )}
    </>
  );
}
