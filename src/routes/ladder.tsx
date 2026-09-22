import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LadderScreen } from "@/components/ladder-screen";

export const Route = createFileRoute("/ladder")({ component: LadderPage });

function LadderPage() {
  return (
    <AppShell title="Ladder">
      <LadderScreen />
    </AppShell>
  );
}
