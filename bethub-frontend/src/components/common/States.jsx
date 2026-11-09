import { useI18n } from "../../contexts/LanguageContext";
import { cn } from "../../lib/utils";

export function Spinner({ className = "" }) {
  const { t } = useI18n();
  return <span className={cn("loader-spinner", className)} role="status" aria-label={t("common.loading")} />;
}

/**
 * Modern route-level loader: twin gradient orbit rings around a cricket
 * ball, an animated label and a sliding progress bar. Respects
 * prefers-reduced-motion via the global CSS rule.
 */
export function PageLoader({ label, sublabel, compact = false }) {
  const { t } = useI18n();
  const text = label ?? t("common.loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-5 text-center",
        compact ? "py-8" : "min-h-[58vh] py-14"
      )}
    >
      <div className="loader-orbit">
        <span className="loader-ring-a" />
        <span className="loader-ring-b" />
        <span className="loader-ball">
          <span className="loader-seam" />
        </span>
      </div>
      <div className="flex flex-col items-center gap-2.5">
        <p className="flex items-center text-sm font-semibold tracking-wide text-white/60">
          {text}
          <span className="loader-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
        <div className="loader-track" aria-hidden="true">
          <span className="loader-bar" />
        </div>
        {sublabel && <p className="max-w-xs text-[11px] leading-relaxed text-white/30">{sublabel}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-coral/10 text-2xl text-coral">!</span>
      <p className="max-w-md text-sm text-white/60">{message || t("common.error")}</p>
      {onRetry && (
        <button className="btn-ghost btn-xs" onClick={() => onRetry()}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, text = "", action }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-xl text-white/40">{icon || "🏏"}</div>
      <p className="font-display text-lg font-600 text-white/80">{title ?? t("common.emptyTitle")}</p>
      {text && <p className="max-w-sm text-sm text-white/45">{text}</p>}
      {action}
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={cn("relative h-40 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]", className)}>
      <span
        className="absolute inset-0 animate-shimmer"
        style={{
          backgroundImage:
            "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.02) 60%, transparent 80%)",
        }}
      />
    </div>
  );
}
