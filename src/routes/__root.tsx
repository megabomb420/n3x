import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { LanguageProvider } from "@/lib/i18n/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { LayoutProbe } from "@/components/layout-probe";
import { VersionGuard } from "@/components/version-guard";
import { AppProviders } from "@/components/app-providers";
import appCss from "../styles.css?url";

const APP_NAME = "'N3X";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Unofficial companion for Brawl Stars club 'N3X (#2JYGUQ2P8) — members, joins and leaves, plus live Ladder vs Ranked meta.",
      },
      { name: "theme-color", content: "#05070a" },
      { name: "color-scheme", content: "dark" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      // Test the opaque default style on installed iOS 26: unlike a CSS
      // offset, it can change which part of the screen WebKit gives the page.
      // The previous black style left an unpaintable band below the tabs.
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/n3x-apple-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Teko:wght@500;600;700&family=IBM+Plex+Mono:wght@500&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  useEffect(() => {
    const preventZoom = (event: Event) => event.preventDefault();
    const preventMultitouchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", preventZoom, { passive: false });
    document.addEventListener("gesturechange", preventZoom, { passive: false });
    document.addEventListener("touchmove", preventMultitouchZoom, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventZoom);
      document.removeEventListener("gesturechange", preventZoom);
      document.removeEventListener("touchmove", preventMultitouchZoom);
    };
  }, []);

  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <LayoutProbe />
        <VersionGuard />
        <AuthProvider>
          <LanguageProvider>
            <AppProviders>
              <Outlet />
            </AppProviders>
          </LanguageProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
