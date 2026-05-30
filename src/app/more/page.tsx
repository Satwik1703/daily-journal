import Link from "next/link";
import {
  Dumbbell,
  Settings,
  BarChart3,
  BookOpen,
  ChevronRight,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/context";
import { SignOutButton } from "./_components/sign-out-button";
import { UserTile } from "@/components/user-tile";

type MoreItem = {
  href: string;
  label: string;
  description: string;
  Icon: typeof Dumbbell;
};

const items: MoreItem[] = [
  {
    href: "/insights",
    label: "Insights",
    description: "Trends across journal, habits, and focus.",
    Icon: BarChart3,
  },
  {
    href: "/gym",
    label: "Gym",
    description: "Log workouts, see the muscle heatmap.",
    Icon: Dumbbell,
  },
  {
    href: "/books",
    label: "Books",
    description: "Reading log, ratings, pages-per-day via the Read habit.",
    Icon: BookOpen,
  },
  {
    href: "/auth/switch",
    label: "Switch user",
    description: "Pick a different tile on this device.",
    Icon: Users,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Daily questions, pomodoro categories, sound, and more.",
    Icon: Settings,
  },
];

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const { user } = await requireUser();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-normal leading-tight">More</h1>
        <p className="text-xs text-muted-foreground">Everything else.</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <UserTile
            name={user.name}
            gradientFrom={user.tileGradientFrom}
            gradientTo={user.tileGradientTo}
            font={user.tileFont}
            border={user.tileBorder}
            size={48}
          />
          <div className="flex-1">
            <div className="font-medium leading-tight">Signed in as {user.name}</div>
            <div className="text-xs text-muted-foreground">
              Each user&apos;s data is private. Switch from below.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map(({ href, label, description, Icon }) => (
          <Link key={href} href={href} className="block group">
            <Card className="transition-colors group-hover:bg-muted/40">
              <CardContent className="flex items-center gap-3 py-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium leading-tight">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <SignOutButton />
    </div>
  );
}
