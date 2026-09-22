import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MetaScreen } from "@/components/meta-screen";

export const Route = createFileRoute("/meta")({ component: MetaPage });

function MetaPage() {
  return (
    <AppShell title="Meta">
      <MetaScreen />
    </AppShell>
  );
}
