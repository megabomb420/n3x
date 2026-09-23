import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { SettingsScreen } from "@/components/settings-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const t = useT();
  return (
    <AppShell title={t("settings.title")}>
      <SettingsScreen />
    </AppShell>
  );
}
