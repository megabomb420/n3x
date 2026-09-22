import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RotationScreen } from "@/components/rotation-screen";

export const Route = createFileRoute("/maps")({ component: MapsPage });

function MapsPage() {
  return (
    <AppShell title="Maps">
      <RotationScreen />
    </AppShell>
  );
}
