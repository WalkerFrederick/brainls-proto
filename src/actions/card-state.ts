"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { userCardStates, userDecks } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { ok, err, type Result } from "@/lib/result";

interface UpdateCardStateInput {
  cardDefinitionId: string;
  srsState?: string;
  intervalDays?: number;
  easeFactor?: number;
  reps?: number;
  lapses?: number;
  dueAt?: string | null;
}

export async function updateCardState(
  input: UpdateCardStateInput,
): Promise<Result<{ count: number }>> {
  const session = await requireSession();

  const states = await db
    .select({
      id: userCardStates.id,
      userDeckId: userCardStates.userDeckId,
    })
    .from(userCardStates)
    .where(eq(userCardStates.cardDefinitionId, input.cardDefinitionId));

  if (states.length === 0) return ok({ count: 0 });

  const ownedDeckIds = await db
    .select({ id: userDecks.id })
    .from(userDecks)
    .where(eq(userDecks.userId, session.user.id));

  const ownedSet = new Set(ownedDeckIds.map((d) => d.id));
  const toUpdate = states.filter((s) => ownedSet.has(s.userDeckId));

  if (toUpdate.length === 0) return err("No study state found for this card");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.srsState !== undefined) updateData.srsState = input.srsState;
  if (input.intervalDays !== undefined) updateData.intervalDays = input.intervalDays;
  if (input.easeFactor !== undefined) updateData.easeFactor = String(input.easeFactor);
  if (input.reps !== undefined) updateData.reps = input.reps;
  if (input.lapses !== undefined) updateData.lapses = input.lapses;
  if (input.dueAt !== undefined) {
    updateData.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  }

  for (const state of toUpdate) {
    await db
      .update(userCardStates)
      .set(updateData)
      .where(eq(userCardStates.id, state.id));
  }

  return ok({ count: toUpdate.length });
}

export async function getCardState(
  cardDefinitionId: string,
): Promise<Result<typeof userCardStates.$inferSelect | null>> {
  const session = await requireSession();

  const [state] = await db
    .select({
      state: userCardStates,
    })
    .from(userCardStates)
    .innerJoin(userDecks, eq(userCardStates.userDeckId, userDecks.id))
    .where(
      and(
        eq(userCardStates.cardDefinitionId, cardDefinitionId),
        eq(userDecks.userId, session.user.id),
      ),
    );

  return ok(state?.state ?? null);
}
