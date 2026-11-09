import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Eye, Film, Heart, Play, Search, Share2, Sparkles, X } from "lucide-react";
import VideoCard from "../components/VideoCard";
import Modal from "../components/common/Modal";
import Tabs from "../components/common/Tabs";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../contexts/LanguageContext";
import { api } from "../lib/api";
import { copyText, formatNumber, formatSeconds, timeAgo } from "../lib/utils";

const typeKeys = {
  short: "videos.typeShort",
  long: "videos.typeLong",
  highlight: "videos.typeHighlight",
  replay: "videos.typeReplay",
};

export default function Videos() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "all";
  const selected = params.get("v") || "";
  const [search, setSearch] = useState(params.get("q") || "");
  const [query, setQuery] = useState(params.get("q") || "");
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState(null);
  const [likes, setLikes] = useState({});
  const { success, error: toastError } = useToast();

  const tabs = [
    { key: "all", label: t("videos.tabAll") },
    { key: "highlight", label: t("videos.tabHighlights") },
    { key: "short", label: t("videos.tabShorts") },
    { key: "long", label: t("videos.tabLong") },
    { key: "replay", label: t("videos.tabReplays") },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const path = useMemo(() => {
    const qs = new URLSearchParams({ limit: "24", page: String(page) });
    if (type !== "all") qs.set("type", type);
    if (query) qs.set("search", query);
    return `/api/media/videos?${qs.toString()}`;
  }, [type, query, page]);

  const { data, loading, refetch } = useFetch(path, { poll: 60000 });

  useSocketEvent("notification", () => refetch(true));

  useEffect(() => {
    setPage(1);
  }, [type, query]);

  useEffect(() => {
    if (!selected) {
      setPlaying(null);
      return;
    }
    let active = true;
    api(`/api/media/videos/${selected}`)
      .then((result) => {
        if (active) setPlaying(result.video);
      })
      .catch(() => {
        if (active) setPlaying(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("v");
    setParams(next, { replace: true });
    setPlaying(null);
  };

  const like = async (video) => {
    try {
      const result = await api(`/api/media/videos/${video._id}/like`, { method: "POST" });
      setLikes((rows) => ({ ...rows, [video._id]: result.likes }));
      setPlaying((current) => (current && current._id === video._id ? { ...current, likes: result.likes } : current));
      success(t("videos.likeSuccess"));
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    const ok = await copyText(window.location.href);
    if (ok) success(t("videos.copied"));
    else toastError(t("videos.copyError"));
  };

  const videos = data?.videos || [];
  const pages = data?.pages || 1;
  const setType = (value) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("type");
    else next.set("type", value);
    next.delete("v");
    setParams(next, { replace: true });
  };

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2"><Film size={13} /> {t("videos.hub")}</p>
          <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("videos.title")}</h1>
          <p className="mt-1 text-sm text-white/45">{t("videos.subtitle")}</p>
        </div>
        <span className="chip"><Sparkles size={11} className="text-lime" /> {t("videos.count", { count: formatNumber(data?.total || 0) })}</span>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={tabs} value={type} onChange={setType} />
        <label className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("videos.search")} className="input !py-2 pl-9 text-xs sm:w-64" />
        </label>
      </div>

      {loading && !data ? (
        <PageLoader label={t("videos.loading")} />
      ) : videos.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button className="btn-ghost btn-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t("common.previous")}</button>
              <span className="text-xs text-white/40">{t("videos.pageOf", { page, pages })}</span>
              <button className="btn-ghost btn-xs" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>{t("common.next")}</button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={<Film size={20} />} title={t("videos.emptyTitle")} text={t("videos.emptyText")} />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={close}
        title={playing?.title || t("videos.bethubVideo")}
        subtitle={playing ? `${t(typeKeys[playing.type] || "videos.typeHighlight")} · ${formatSeconds(playing.duration)} · ${t("live.views", { count: formatNumber(playing.views || 0) })}` : ""}
        size="xl"
        footer={
          playing && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-white/35">{playing.createdAt ? timeAgo(playing.createdAt) : ""}{playing.match?.series ? ` · ${playing.match.series}` : ""}</p>
              <div className="flex gap-2">
                <button onClick={() => like(playing)} className="btn-ghost btn-xs"><Heart size={13} className="text-coral" /> {formatNumber(likes[playing._id] ?? playing.likes)}</button>
                <button onClick={share} className="btn-ghost btn-xs"><Share2 size={13} /> {t("videos.share")}</button>
              </div>
            </div>
          )
        }
      >
        {playing ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              {playing.url ? (
                <video key={playing._id} src={playing.url} poster={playing.thumbnail} controls autoPlay playsInline className="aspect-video w-full bg-black object-contain" />
              ) : (
                <div className="grid aspect-video place-items-center text-white/30"><Play size={28} /></div>
              )}
            </div>
            <p className="text-sm leading-relaxed text-white/60">{playing.description || t("videos.noDescription")}</p>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/35">
              <span className="chip"><Clock3 size={11} /> {formatSeconds(playing.duration)}</span>
              <span className="chip"><Eye size={11} /> {formatNumber(playing.views)}</span>
              {playing.match?.teamA && <span className="chip">{playing.match.teamA?.shortName} vs {playing.match.teamB?.shortName}</span>}
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-white/30"><X size={20} /></div>
        )}
      </Modal>
    </div>
  );
}
