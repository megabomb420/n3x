import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ListsScreen } from "@/components/lists-screen";

export const Route = createFileRoute("/lists")({ component: ListsPage });

function ListsPage() {
  return (
    <AppShell
      title="Lists"
      showSearch
      headerRight={
        <Link to="/about" className="px-1.5 text-xs text-muted">
          Data
        </Link>
      }
    >
      <ListsScreen />
    </AppShell>
  );
}
