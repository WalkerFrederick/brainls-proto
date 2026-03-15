import { Brain } from "lucide-react";
import { getSession } from "@/lib/auth-server";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Brain className="h-16 w-16 text-primary" />
      <h1 className="text-3xl font-bold">Welcome to BrainLS</h1>
      {session ? (
        <p className="text-muted-foreground">
          Hello, {session.user.name ?? session.user.email}! Head to your{" "}
          <a href="/library" className="text-primary hover:underline">
            Library
          </a>{" "}
          to start studying.
        </p>
      ) : (
        <p className="text-muted-foreground">Sign in to start learning.</p>
      )}
    </div>
  );
}
