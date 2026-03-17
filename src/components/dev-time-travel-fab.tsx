"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronUp, ChevronDown, FastForward } from "lucide-react";
import { advanceTime, listUserDecks } from "@/actions/study";

interface UserDeck {
  id: string;
  deckTitle: string;
}

type Unit = "min" | "day";

export function DevTimeTravelFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<Unit>("min");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    listUserDecks().then((result) => {
      if (result.success) {
        setDecks(result.data);
        if (result.data.length > 0 && !selectedDeckId) {
          setSelectedDeckId(result.data[0].id);
        }
      }
    });
  }, [open, selectedDeckId]);

  function handleAdvanceTime() {
    if (!selectedDeckId) return;
    const minutes = unit === "day" ? amount * 1440 : amount;
    startTransition(async () => {
      const result = await advanceTime(selectedDeckId, minutes);
      if (result.success) {
        setMessage(
          `Advanced ${amount}${unit === "day" ? "d" : "m"} (${result.data.updated} cards)`,
        );
        router.refresh();
      } else {
        setMessage(`Error: ${result.error}`);
      }
      setTimeout(() => setMessage(""), 3000);
    });
  }

  if (process.env.NODE_ENV === "production") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-600 bg-amber-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        title="Dev Time Travel"
      >
        <Clock className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed bottom-20 left-4 z-50 w-72 rounded-xl border bg-popover p-4 shadow-2xl">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-amber-500" />
            Dev Time Travel
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Deck</label>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {decks.length === 0 && <option value="">Loading...</option>}
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.deckTitle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Advance due dates by
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmount(Math.max(1, amount - 1))}
                  className="rounded border p-1 hover:bg-accent"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <span className="min-w-[3ch] text-center text-sm font-medium">{amount}</span>
                <button
                  type="button"
                  onClick={() => setAmount(amount + 1)}
                  className="rounded border p-1 hover:bg-accent"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setUnit(unit === "min" ? "day" : "min")}
                  className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent"
                >
                  {unit === "min" ? "min" : "day"}
                </button>
                <button
                  type="button"
                  onClick={handleAdvanceTime}
                  disabled={isPending || !selectedDeckId}
                  className="ml-auto flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <FastForward className="h-3 w-3" />
                  {isPending ? "..." : "Advance"}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-3 rounded-md bg-muted px-3 py-1.5 text-xs font-medium">
              {message}
            </div>
          )}
        </div>
      )}
    </>
  );
}
