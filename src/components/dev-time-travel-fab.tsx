"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronUp, ChevronDown, FastForward, Zap } from "lucide-react";
import { advanceTime, listUserDecks } from "@/actions/study";
import { CHAOS_MONKEY_CHANCE } from "@/lib/errors";

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
  const [chaosEnabled, setChaosEnabled] = useState(() =>
    typeof document !== "undefined" ? document.cookie.includes("chaos_monkey=1") : false,
  );

  function toggleChaos() {
    const next = !chaosEnabled;
    document.cookie = `chaos_monkey=${next ? "1" : "0"};path=/`;
    setChaosEnabled(next);
  }

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
        className={`fixed bottom-4 left-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-transform hover:scale-105 active:scale-95 ${chaosEnabled ? "border-red-500 bg-red-500 text-white" : "border-amber-600 bg-amber-500 text-white"}`}
        title={chaosEnabled ? "Dev Tools (Chaos Monkey ON)" : "Dev Tools"}
      >
        {chaosEnabled ? <Zap className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
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

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={toggleChaos}
              className="flex w-full items-center justify-between rounded-md px-1 py-1 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <Zap
                  className={`h-4 w-4 ${chaosEnabled ? "text-red-500" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-medium">Chaos Monkey</span>
              </div>
              <div
                className={`h-5 w-9 rounded-full transition-colors ${chaosEnabled ? "bg-red-500" : "bg-muted"}`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${chaosEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </div>
            </button>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Randomly fail 1/{Math.round(1 / CHAOS_MONKEY_CHANCE)} server calls
            </p>
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
