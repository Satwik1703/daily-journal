export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32 space-y-3">
      <div className="h-12 animate-pulse rounded-md bg-muted/40" />
      <div className="h-14 animate-pulse rounded-md bg-muted/40" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted/30" />
      ))}
    </div>
  );
}
