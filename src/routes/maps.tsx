import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RotationScreen } from "@/components/rotation-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/maps")({ component: MapsPage });

function MapsPage() {
  const t = useT();
  return (
    <AppShell title={t("nav.maps")}>
      <RotationScreen />
    </AppShell>
  );
}
