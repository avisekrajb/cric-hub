import { cn } from "../../lib/utils";

export default function Tabs({ tabs, value, onChange, className = "", size = "md" }) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1", className)}>
      {tabs.map((tab) => {
        const key = typeof tab === "string" ? tab : tab.key;
        const label = typeof tab === "string" ? tab : tab.label;
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "whitespace-nowrap rounded-lg font-semibold transition",
              size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs",
              active ? "bg-lime text-ink-950 shadow-glow" : "text-white/50 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
