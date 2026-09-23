import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MetaScreen } from "@/components/meta-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/meta")({ component: MetaPage });

function MetaPage() {
  const t = useT();
  return (
    <AppShell title={t("nav.meta")}>
      <MetaScreen />
    </AppShell>
  );
}
