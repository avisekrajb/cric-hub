import { cn } from "../../lib/utils";

export function AdminPage({ eyebrow, title, subtitle, actions, children }) {
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-0.5 font-display text-2xl font-700 tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45 sm:text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, accent = "text-lime", onClick, to, className = "" }) {
  const inner = (
    <div className={cn("card relative overflow-hidden p-4 transition", (onClick || to) && "card-hover", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</p>
          <p className="mt-1 font-display text-2xl font-700 tabular-nums text-white">{value}</p>
          {hint && <p className="mt-0.5 text-[10px] text-white/30">{hint}</p>}
        </div>
        {Icon && <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05]", accent)}><Icon size={17} /></span>}
      </div>
    </div>
  );
  return inner;
}

export function Panel({ title, subtitle, action, children, className = "", bodyClassName = "" }) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-bold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[10px] text-white/35">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, required, children, className = "" }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="label">{label}{required && <span className="ml-0.5 text-lime">*</span>}</span>}
      {children}
      {hint && <span className="mt-1 block text-[10px] text-white/30">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white/75">{label}</span>
        {hint && <span className="block text-[10px] text-white/30">{hint}</span>}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-lime" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function EmptyRow({ text = "Nothing here yet." }) {
  return <p className="px-4 py-8 text-center text-xs text-white/35">{text}</p>;
}

export function StatusDot({ active, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-mint" : "bg-white/20")} /> {label}
    </span>
  );
}
