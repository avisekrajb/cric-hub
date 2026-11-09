import { Link } from "react-router-dom";
import { Clock3, Eye, Play } from "lucide-react";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber, formatSeconds } from "../lib/utils";

const typeKeys = { short: "videos.typeShort", long: "videos.typeLong", highlight: "videos.typeHighlight", replay: "videos.typeReplay" };

export default function VideoCard({ video, className = "", compact = false }) {
  const { t } = useI18n();
  if (!video) return null;
  return (
    <Link
      to={`/videos?v=${video._id}`}
      className={cn("group block overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-lime/25", className)}
    >
      <div className="relative aspect-video overflow-hidden bg-ink-800">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} loading="lazy" className="h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-ink-700 to-ink-900 text-white/20"><Play size={28} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-transparent" />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/65 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/75 backdrop-blur">
          {t(typeKeys[video.type] || "videos.typeHighlight")}
        </span>
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white/80">
          <Clock3 size={9} /> {formatSeconds(video.duration)}
        </span>
        <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-lime text-ink-950 shadow-glow">
            <Play size={18} fill="currentColor" />
          </span>
        </span>
      </div>
      <div className={cn("p-3", compact && "p-2.5")}>
        <p className={cn("line-clamp-2 font-semibold leading-snug text-white/85 transition group-hover:text-white", compact ? "text-[12px]" : "text-[13px]")}>
          {video.title}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/35">
          <span className="inline-flex items-center gap-1"><Eye size={10} /> {formatNumber(video.views)}</span>
          <span className="inline-flex items-center gap-1">♥ {formatNumber(video.likes)}</span>
          {video.match?.series && <span className="truncate">{video.match.series}</span>}
        </div>
      </div>
    </Link>
  );
}
