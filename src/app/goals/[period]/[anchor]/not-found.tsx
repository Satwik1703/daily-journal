import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-12 pb-8">
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <h1 className="font-serif text-xl">That period doesn&apos;t exist</h1>
          <p className="text-xs text-muted-foreground">
            Use the toggle to switch between week, month, and year.
          </p>
          <Button render={<Link href="/goals" />}>Back to current week</Button>
        </CardContent>
      </Card>
    </div>
  );
}
