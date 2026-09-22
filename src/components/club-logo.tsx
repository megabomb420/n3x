import { cn } from "@/lib/utils";

export function ClubLogo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/n3x-mark.png"
      alt=""
      width={size}
      height={size}
      className={cn("mark shrink-0 object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
