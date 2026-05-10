import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function JournalLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8">
      <div className="-mx-4 mb-4 flex items-center justify-between border-b border-border/60 px-4 py-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-12" />
        </div>
        <Skeleton className="size-9 rounded-md" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-8 rounded" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
          <CardContent><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
      </div>
    </div>
  );
}
