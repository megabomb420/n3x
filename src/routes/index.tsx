import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ClubScreen } from "@/components/club-screen";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppShell
      title="Club"
      headerRight={
        <Link to="/about" className="px-1.5 text-xs text-muted">
          Data
        </Link>
      }
    >
      <ClubScreen />
    </AppShell>
  );
}
