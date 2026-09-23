import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MemberScreen } from "@/components/member-screen";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/m/$tag")({ component: MemberPage });

function MemberPage() {
  const { tag } = Route.useParams();
  const t = useT();
  return (
    <AppShell title={t("member.title")}>
      <MemberScreen tag={tag} />
    </AppShell>
  );
}
