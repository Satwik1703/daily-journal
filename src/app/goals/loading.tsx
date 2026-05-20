import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-24 space-y-5">
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
