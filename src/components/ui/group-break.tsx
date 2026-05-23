import { cn } from "@/lib/utils";

/**
 * Thin hairline with a small uppercase label in the middle.
 * Used to visually group sections of a page (journal-form, goals page).
 */
export function GroupBreak({
  label,
  first = false,
  className,
}: {
  label: string;
  first?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-1", first ? "mt-2" : "mt-6", className)}>
      <span className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}
