import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MapScreen } from "@/components/map-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/maps/$map")({ component: MapPage });

function MapPage() {
  const { map } = Route.useParams();
  const t = useT();
  return (
    <AppShell title={t("map.title")}>
      <MapScreen map={map} />
    </AppShell>
  );
}
