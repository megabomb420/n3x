import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MetaScreen } from "@/components/meta-screen";

export const Route = createFileRoute("/meta")({ component: MetaPage });

function MetaPage() {
  return (
    <AppShell
      title="Meta"
      showQueue
      showSearch
      headerRight={
        <Link to="/about" className="px-1.5 text-xs text-muted">
          Data
        </Link>
      }
    >
      <MetaScreen />
    </AppShell>
  );
}
