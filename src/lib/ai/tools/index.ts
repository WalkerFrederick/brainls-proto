import type { ToolDefinition } from "../types";
import { createUserTools } from "./user";
import { createFolderTools } from "./folders";
import { createDeckTools } from "./decks";
import { createCardTools } from "./cards";
import { createTagTools } from "./tags";

export function createTools(userId: string): ToolDefinition[] {
  return [
    ...createUserTools(userId),
    ...createFolderTools(userId),
    ...createDeckTools(userId),
    ...createCardTools(userId),
    ...createTagTools(userId),
  ];
}
