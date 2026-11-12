import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Eye, GripHorizontal, Maximize2, Minimize2, Radio, X } from "lucide-react";
import LiveVideoPlayer from "./LiveVideoPlayer";
import { useSocketEvent } from "../contexts/SocketContext";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber, matchViews, readStorage, scoreSummary, writeStorage } from "../lib/utils";

const POS_KEY = "bethub_floating_player_pos";
const WIDTH = 352;

export default function FloatingLivePlayer({ match }) {
  const { t } = useI18n();
  const [minimized, setMinimized] = useState(() => readStorage("bethub_player_min", false));
  const [closed, setClosed] = useState(false);
  const [position, setPosition] = useState(() => readStorage(POS_KEY, null));
  const [viewers, setViewers] = useState(match?.stream?.viewers || 0);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  useSocketEvent("stream:viewers", ({ matchId, viewers: count }) => {
    if (String(matchId) === String(match?._id)) setViewers(count);
  });

  useEffect(() => {
    if (!match?.stream?.isLive) setClosed(false);
  }, [match?.stream?.isLive]);

  useEffect(() => {
    writeStorage("bethub_player_min", minimized);
  }, [minimized]);

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = {
        x: Math.min(window.innerWidth - 60, Math.max(8, drag.x + event.clientX - drag.startX)),
        y: Math.min(window.innerHeight - 60, Math.max(8, drag.y + event.clientY - drag.startY)),
      };
      setPosition(next);
    };
    const up = () => {
      setDragging(false);
      dragRef.current = null;
      if (position) writeStorage(POS_KEY, position);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
  }, [dragging, position]);

  if (!match?.stream?.isLive || closed) return null;

  const scores = scoreSummary(match);
  const views = matchViews(match);
  const href = match.stream?.slug ? `/live/${match.stream.slug}` : `/match/${match._id}`;

  const startDrag = (event) => {
    if (event.target.closest("[data-no-drag]")) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: rect.left, y: rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  };

  const style = position
    ? { left: Math.min(position.x, window.innerWidth - 80), top: Math.min(position.y, window.innerHeight - 60), width: minimized ? 268 : WIDTH }
    : { width: minimized ? 268 : WIDTH };

  return (
    <div
      ref={boxRef}
      style={style}
      className={cn(
        "video-shell fixed z-[60] overflow-hidden rounded-2xl border border-lime/20 bg-ink-900/95 shadow-[0_30px_90px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl transition-[width,box-shadow] duration-200 hover:border-lime/35 hover:shadow-[0_34px_100px_-18px_rgba(200,255,61,.22)]",
        !position && "bottom-4 right-4",
        dragging && "select-none"
      )}
    >
      <div
        onPointerDown={startDrag}
        className={cn(
          "flex items-center gap-2 border-b border-white/10 bg-ink-850/95 px-3 py-2 backdrop-blur",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <GripHorizontal size={14} className="shrink-0 text-white/25" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-coral/70" />
            <span className="relative h-2 w-2 rounded-full bg-coral" />
          </span>
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-white/75">{t("floating.live")}</span>
          <span className="hidden truncate text-[10px] text-white/40 sm:block">{t("floating.watching", { count: formatNumber(viewers) })}</span>
          <span className="hidden items-center gap-1 text-[10px] text-white/30 md:inline-flex">
            <Eye size={10} /> {formatNumber(views)}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5" data-no-drag>
          <Link to={href} className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-lime" title={t("floating.openLive")}>
            <ArrowUpRight size={13} />
          </Link>
          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            title={minimized ? t("floating.expand") : t("floating.minimize")}
            aria-label={minimized ? t("floating.expand") : t("floating.minimize")}
          >
            {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={() => setClosed(true)}
            className="rounded p-1 text-white/40 transition hover:bg-coral/20 hover:text-coral"
            title={t("floating.close")}
            aria-label={t("floating.close")}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {minimized ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
            <span className="absolute inset-0 animate-ring-pulse rounded-xl border border-coral/30" />
            <Radio size={16} className="relative" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-white/85">
              {match.teamA?.shortName} <span className="text-white/30">{t("detail.vs")}</span> {match.teamB?.shortName}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/45">
              <span className="truncate">{scores.a || "—"}</span>
              <span className="text-white/25">·</span>
              <span className="truncate">{scores.b || "—"}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-lime">
            {t("floating.open")} <ArrowUpRight size={11} />
          </span>
        </button>
      ) : (
        <div className="animate-fade-up">
          <LiveVideoPlayer match={match} compact showMeta={false} className="!rounded-none !border-0 !shadow-none" />
          <Link
            to={href}
            className="flex items-center justify-between gap-2 px-3 py-2 transition hover:bg-white/[0.04]"
          >
            <p className="min-w-0 truncate text-[11px] font-semibold text-white/75">
              {match.teamA?.shortName} <span className="text-white/30">{t("detail.vs")}</span> {match.teamB?.shortName}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <p className="font-mono text-[10px] text-lime">{scores.a || "—"}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                <Eye size={10} /> {formatNumber(views)}
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
