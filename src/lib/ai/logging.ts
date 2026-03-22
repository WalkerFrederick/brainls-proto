import { db } from "@/db";
import { aiLogs } from "@/db/schema";
import { reportError } from "@/lib/errors";
import { err, type Result } from "@/lib/result";
import { getAiLimitInfo, getAiUsageCount, checkAiErrorBudget } from "@/lib/tiers";
import type { ProviderConfig } from "./types";

export async function checkAiLimit(userId: string): Promise<Result<void> | null> {
  const limitInfo = await getAiLimitInfo(userId);
  const currentUsage = await getAiUsageCount(userId, limitInfo.periodStart);
  if (currentUsage >= limitInfo.limit) {
    const periodWord = limitInfo.period === "day" ? "daily" : "monthly";
    return err("LIMIT_EXCEEDED", `You've reached your ${periodWord} AI usage limit`);
  }

  const withinErrorBudget = await checkAiErrorBudget(userId, limitInfo.tierName);
  if (!withinErrorBudget) {
    return err("LIMIT_EXCEEDED", "AI is temporarily unavailable — please try again later");
  }

  return null;
}

export async function handleAiError(
  e: unknown,
  ctx: { userId: string; action: string; startMs: number; inputSnapshot: Record<string, unknown> },
): Promise<Result<never>> {
  const durationMs = Date.now() - ctx.startMs;
  const status = (e as { status?: number }).status;
  const errorType = (e as { error?: { type?: string } }).error?.type;

  reportError(e, { action: ctx.action, status, errorType });
  await logAiCall({
    userId: ctx.userId,
    action: ctx.action,
    model: "unknown",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    durationMs,
    input: ctx.inputSnapshot,
    output: null,
    error: String(e),
  });

  if (status === 429) {
    return err(
      "LIMIT_EXCEEDED",
      "AI is temporarily unavailable — please try again in a few minutes",
    );
  }
  return err("INTERNAL_ERROR", "AI is unavailable right now — please try again later");
}

export function estimateCost(
  provider: ProviderConfig,
  inputTokens: number,
  outputTokens: number,
): number {
  const { pricing } = provider;
  return (inputTokens * pricing.inputPerM + outputTokens * pricing.outputPerM) / 1_000_000;
}

interface LogAiCallInput {
  userId: string;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
}

export async function logAiCall(data: LogAiCallInput): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const cost = data.estimatedCostUsd.toFixed(6);
    console.debug(
      `[ai] ${data.action} (${data.model}) — ${data.inputTokens} in / ${data.outputTokens} out / ~$${cost} / ${data.durationMs}ms`,
    );
  }

  try {
    await db.insert(aiLogs).values({
      userId: data.userId,
      action: data.action,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      estimatedCostUsd: data.estimatedCostUsd.toFixed(8),
      durationMs: data.durationMs,
      input: data.input,
      output: data.output,
      error: data.error ?? null,
    });
  } catch (e) {
    reportError(e, { context: "logAiCall" });
  }
}
