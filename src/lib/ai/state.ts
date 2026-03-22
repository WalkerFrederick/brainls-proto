import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

export const MAX_ITERATIONS = 12;
export const MAX_INPUT_TOKENS = 60_000;

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  iterations: Annotation<number>({
    reducer: (curr: number, update: number) => curr + update,
    default: () => 0,
  }),

  tokenUsage: Annotation<{ input: number; output: number }>({
    reducer: (
      curr: { input: number; output: number },
      update: { input: number; output: number },
    ) => ({
      input: curr.input + update.input,
      output: curr.output + update.output,
    }),
    default: () => ({ input: 0, output: 0 }),
  }),

  writeCount: Annotation<number>({
    reducer: (curr: number, update: number) => curr + update,
    default: () => 0,
  }),

  mutatedEntities: Annotation<string[]>({
    reducer: (curr: string[], update: string[]) => [...new Set([...curr, ...update])],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;
