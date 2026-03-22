import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let _checkpointer: PostgresSaver | null = null;
let _setupDone = false;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!_checkpointer) {
    _checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  }
  if (!_setupDone) {
    await _checkpointer.setup();
    _setupDone = true;
  }
  return _checkpointer;
}
