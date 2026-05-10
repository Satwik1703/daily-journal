import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JournalNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-12 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl font-normal">That date doesn’t exist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The journal date should look like <code className="font-mono text-xs">YYYY-MM-DD</code>.
          </p>
          <Link href="/journal">
            <Button>Go to today</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
