import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n } from "../../contexts/LanguageContext";
import { cn } from "../../lib/utils";

export default function LanguageSwitcher({ variant = "default", className = "" }) {
  const { language, setLanguage, languages, current, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  if (variant === "block") {
    return (
      <div className={cn("rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3", className)}>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
          <Globe size={12} /> {t("lang.label")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => choose(item.code)}
              className={cn(
                "flex items-center justify-between gap-1 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold transition",
                language === item.code
                  ? "border-lime/40 bg-lime/10 text-lime"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:border-lime/30 hover:text-white"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{item.native}</span>
                <span className="block truncate text-[9px] font-medium text-white/30">{item.label}</span>
              </span>
              {language === item.code && <Check size={12} className="shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const compact = variant === "compact";

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("lang.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${t("lang.label")}: ${current.native}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-lime/40 hover:text-lime",
          compact ? "h-9 px-2" : "h-9 px-2.5"
        )}
      >
        <Globe size={15} className="shrink-0" />
        <span className="text-[11px] font-bold">{compact ? current.short : current.native}</span>
        <ChevronDown size={12} className={cn("transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("lang.label")}
          className="absolute right-0 z-[70] mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-card"
        >
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              aria-selected={language === item.code}
              onClick={() => choose(item.code)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition",
                language === item.code
                  ? "bg-lime/10 text-lime"
                  : "text-white/65 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{item.native}</span>
                <span className="block truncate text-[9px] font-medium text-white/30">{item.label}</span>
              </span>
              {language === item.code && <Check size={13} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
