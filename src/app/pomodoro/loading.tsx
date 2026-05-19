import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PomodoroLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Card>
        <CardContent className="p-8">
          <Skeleton className="mx-auto h-56 w-56 rounded-full" />
        </CardContent>
      </Card>
    </div>
  );
}
