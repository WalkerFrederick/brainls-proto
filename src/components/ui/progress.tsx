import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  const isIndeterminate = value === undefined;

  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      {isIndeterminate ? (
        <div
          className="absolute inset-y-0 left-0 w-[40%] rounded-full bg-primary"
          style={{ animation: "progress-indeterminate 1.4s ease-in-out infinite" }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      )}
    </div>
  );
}

export { Progress };
