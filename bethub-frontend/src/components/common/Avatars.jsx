import { useState } from "react";
import { cn, initials } from "../../lib/utils";

const sizes = {
  xs: "h-6 w-6 text-[9px] rounded-md",
  sm: "h-8 w-8 text-[10px] rounded-lg",
  md: "h-11 w-11 text-xs rounded-xl",
  lg: "h-16 w-16 text-base rounded-2xl",
  xl: "h-20 w-20 text-lg rounded-2xl",
};

export function TeamLogo({ team, size = "md", className = "", ring = false }) {
  const [failed, setFailed] = useState(false);
  const url = team?.logo?.url || team?.country?.flag?.url;
  const label = team?.shortName || team?.name || "?";
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden border border-white/10 bg-white/[0.04] font-bold text-white/75",
        sizes[size],
        ring && "ring-2 ring-lime/30 ring-offset-2 ring-offset-ink-950",
        className
      )}
      style={team?.color ? { backgroundColor: `${team.color}18` } : undefined}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={team?.name || "Team"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{label.slice(0, 3).toUpperCase()}</span>
      )}
    </span>
  );
}

export function PlayerAvatar({ player, size = "sm", className = "" }) {
  const [failed, setFailed] = useState(false);
  const url = player?.photo?.url || player?.avatar?.url;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-ink-700 to-ink-850 font-semibold text-white/70",
        sizes[size],
        "!rounded-full",
        className
      )}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={player?.name || "Player"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(player?.name)}</span>
      )}
    </span>
  );
}

export function CountryFlag({ country, className = "" }) {
  const url = country?.flag?.url;
  if (!url) return null;
  return (
    <img
      src={url}
      alt={country?.name || country?.code || ""}
      className={cn("h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-white/15", className)}
      loading="lazy"
    />
  );
}
