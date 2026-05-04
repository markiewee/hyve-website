import { cn } from "../../lib/utils";

const SIZE_STYLES = {
  sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
  md: "text-xs px-2 py-1 gap-1",
};

export default function CaptainBadge({ size = "md", className }) {
  const label = size === "sm" ? "Captain" : "House Captain";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium bg-blue-100 text-blue-700",
        SIZE_STYLES[size],
        className,
      )}
      aria-label="House Captain"
    >
      <span aria-hidden>🏠</span>
      <span>{label}</span>
    </span>
  );
}
