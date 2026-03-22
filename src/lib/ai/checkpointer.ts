import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let _promise: Promise<PostgresSaver> | null = null;

export function getCheckpointer(): Promise<PostgresSaver> {
  if (!_promise) {
    _promise = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      const saver = PostgresSaver.fromConnString(url);
      await saver.setup();
      return saver;
    })();
  }
  return _promise;
}
