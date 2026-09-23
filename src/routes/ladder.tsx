import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LadderScreen } from "@/components/ladder-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/ladder")({ component: LadderPage });

function LadderPage() {
  const t = useT();
  return (
    <AppShell title={t("nav.ladder")}>
      <LadderScreen />
    </AppShell>
  );
}
