import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One map's picture, with the chain the Maps tab established: the map art from
 * the catalog, then the mode's own art, then the map's own initial.
 *
 * `fit` is the whole difference between a list card (`cover`: fill the frame and
 * crop) and the picture view (`contain`: show the whole board, which is 690x1050).
 */
export function MapArt({
  mapArt,
  modeArt,
  alt,
  fit = "cover",
  className,
}: {
  mapArt: string | null;
  modeArt: string | null;
  alt: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [step, setStep] = useState(0);
  // A new picture starts its own chain; otherwise a reopened card could jump
  // straight to the mode art because the last map had already stepped.
  useEffect(() => setStep(0), [mapArt, modeArt]);

  const candidates = [mapArt, modeArt].filter((url): url is string => Boolean(url));
  const src = candidates[step];

  if (!src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-surface-2 text-subtle", className)}
        aria-hidden
      >
        <span className="font-display text-3xl tracking-wide">{alt.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("bg-surface-2", fit === "cover" ? "object-cover" : "object-contain", className)}
      onError={() => setStep((current) => current + 1)}
    />
  );
}
