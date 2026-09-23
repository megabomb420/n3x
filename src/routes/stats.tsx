import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StatsScreen } from "@/components/stats-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  const t = useT();
  return (
    <AppShell title={t("nav.stats")}>
      <StatsScreen />
    </AppShell>
  );
}
