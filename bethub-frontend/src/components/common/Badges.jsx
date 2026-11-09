import { useI18n } from "../../contexts/LanguageContext";
import { cn } from "../../lib/utils";

const statusKeys = {
  live: "status.live",
  "innings-break": "status.inningsBreak",
  finished: "status.finished",
  upcoming: "status.upcoming",
  abandoned: "status.abandoned",
};

export function LiveBadge({ className = "", label, pulse = true }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-coral", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-coral", pulse && "animate-pulseDot")} />
      {label ?? t("status.live")}
    </span>
  );
}

export function StatusPill({ status, className = "" }) {
  const { t } = useI18n();
  const styles =
    status === "live"
      ? "bg-coral/15 text-coral"
      : status === "finished"
        ? "bg-white/[0.06] text-white/55"
        : status === "upcoming"
          ? "bg-sky/10 text-sky"
          : status === "innings-break"
            ? "bg-amber-400/10 text-amber-300"
            : "bg-white/[0.06] text-white/50";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]", styles, className)}>
      {status === "live" && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" />}
      {t(statusKeys[status] || "status.upcoming")}
    </span>
  );
}

export function DeltaChip({ value, suffix = "" }) {
  const number = Number(value) || 0;
  return (
    <span className={cn("chip", number > 0 ? "!text-mint" : number < 0 ? "!text-coral" : "")}>
      {number > 0 ? "▲" : number < 0 ? "▼" : "•"} {Math.abs(number)}{suffix}
    </span>
  );
}

export default { LiveBadge, StatusPill, DeltaChip };
