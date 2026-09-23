import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

/**
 * The router runs under whatever base Vite built for (`/` for the Worker/Sites
 * builds, `/n3x/` for a GitHub Pages project site), so links and deep links stay
 * correct without a second source of truth.
 */
const basepath = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: basepath || "/",
    // Static hosts publish each prerendered route as /route/index.html. Link to
    // that canonical URL; a host redirect from /route to /route/ otherwise
    // changes the URL between the streamed HTML and client hydration.
    trailingSlash: "always",
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
    scrollRestoration: false,
  });
}
