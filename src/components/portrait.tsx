import { portraitUrl } from "@/lib/meta/brawlapi";
import { displayBrawlerName } from "@/lib/meta/names";
import type { BrawlerCatalogItem } from "@/lib/meta/types";
import { cn } from "@/lib/utils";

export function Portrait({
  catalog,
  cubeName,
  size = 40,
  className,
  decorative = false,
}: {
  catalog: BrawlerCatalogItem | null;
  cubeName: string;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const src = portraitUrl(catalog, cubeName);
  const label = catalog?.name ?? displayBrawlerName(cubeName);
  return (
    <img
      src={src}
      alt={decorative ? "" : label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-md bg-surface-2 object-cover", className)}
      style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "1") {
          el.style.visibility = "hidden";
          return;
        }
        el.dataset.fallback = "1";
        el.src = `https://media.brawltime.ninja/brawlers/${cubeName.toLowerCase().replace(/\./g, "_").replace(/ /g, "_")}/avatar.png?size=160`;
      }}
    />
  );
}

export function MapArt({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-surface-2 text-subtle", className)}
        aria-hidden
      >
        <span className="font-display text-2xl tracking-wide">{alt.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("bg-surface-2 object-cover object-top", className)}
    />
  );
}
