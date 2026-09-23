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
        <Link
          to="/about"
          replace
          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted"
        >
          {t("about.title")}
        </Link>
      }
    >
      <ClubScreen />
    </AppShell>
  );
}
