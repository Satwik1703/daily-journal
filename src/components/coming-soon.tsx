import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-10 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl font-normal">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{subtitle}</p>
          <p className="text-xs">Coming next — Day 1 ships the journal first.</p>
        </CardContent>
      </Card>
    </div>
  );
}
