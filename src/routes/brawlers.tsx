import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/brawlers")({ component: BrawlersLayout });

function BrawlersLayout() {
  return <Outlet />;
}
