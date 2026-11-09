import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export default function Logo({ className = "", compact = false, to = "/" }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Bethub home">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-lime text-ink-950 shadow-glow transition-transform group-hover:rotate-6">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12 6.5c-2.6 5.4-2.6 13.6 0 19M20 6.5c2.6 5.4 2.6 13.6 0 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.5 12h15M8.5 16h15M8.5 20h15" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[22px] font-700 tracking-tight text-white">
          Bet<span className="text-lime">hub</span>
          <span className="text-lime">.</span>
        </span>
      )}
    </Link>
  );
}
