import { GymInsightsPageClient } from "./_components/insights-page-client";

export default function GymInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  void searchParams;
  return <GymInsightsPageClient />;
}
