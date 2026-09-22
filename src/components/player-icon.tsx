import { cn } from "@/lib/utils";

export function PlayerIcon({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={src || "/n3x-mark.png"}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("mark shrink-0 rounded-md bg-surface-2 object-cover", className)}
      style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "1") return;
        el.dataset.fallback = "1";
        el.src = "/n3x-mark.png";
      }}
    />
  );
}
