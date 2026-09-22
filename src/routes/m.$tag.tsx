import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MemberScreen } from "@/components/member-screen";

export const Route = createFileRoute("/m/$tag")({ component: MemberPage });

function MemberPage() {
  const { tag } = Route.useParams();
  return (
    <AppShell title="Member">
      <MemberScreen tag={tag} />
    </AppShell>
  );
}
