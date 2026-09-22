import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatsScreen } from "@/components/stats-screen";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  return (
    <AppShell title="Stats">
      <StatsScreen />
    </AppShell>
  );
}
