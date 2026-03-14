import { Brain } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Brain className="h-16 w-16 text-primary" />
      <h1 className="text-3xl font-bold">Welcome to BrainLS</h1>
      <p className="text-muted-foreground">Your modern flashcard learning platform.</p>
    </div>
  );
}
