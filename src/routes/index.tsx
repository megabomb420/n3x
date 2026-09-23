import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ClubScreen } from "@/components/club-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const t = useT();
  return (
    <AppShell
      title={t("nav.club")}
      headerRight={
        <Link to="/about" className="px-1.5 text-xs text-muted">
          {t("about.title")}
        </Link>
      }
    >
      <ClubScreen />
    </AppShell>
  );
}
