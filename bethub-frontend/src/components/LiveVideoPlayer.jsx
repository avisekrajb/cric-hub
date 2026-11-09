import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, Loader2, Maximize2, Minimize2, Play, Radio, Volume2, VolumeX, WifiOff } from "lucide-react";
import LiveKitViewer from "./LiveKitViewer";
import { useSocket } from "../contexts/SocketContext";
import { useI18n } from "../contexts/LanguageContext";
import { api } from "../lib/api";
import { cn, formatNumber, teamName } from "../lib/utils";
import { LiveBadge } from "./common/Badges";

const normalizeEmbed = (url = "") => {
  if (!url) return "";
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1&mute=1`;
  return url;
};

function HlsPlayer({ src, poster, className = "" }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;
    setError("");
    setLoading(true);
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 60, maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else {
            setError(t("video.loadError"));
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    } else {
      setError(t("video.hlsUnsupported"));
      setLoading(false);
    }
    return () => {
      hls?.destroy();
    };
  }, [src, t]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        muted
        autoPlay
        className="h-full w-full object-contain"
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onLoadedData={() => setLoading(false)}
      />
      {loading && !error && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/70">
            <Loader2 size={14} className="animate-spin text-lime" /> {t("video.tuning")}
          </span>
        </span>
      )}
      {error && (
        <span className="absolute inset-0 grid place-items-center bg-ink-950/90 p-6 text-center text-xs text-white/60">
          <span className="max-w-xs"><AlertCircle className="mx-auto mb-2 text-coral" size={20} /> {error}</span>
        </span>
      )}
    </div>
  );
}

function CameraPlayer({ matchId, active, poster }) {
  const { t } = useI18n();
  const { socket, joinStream } = useSocket();
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const broadcasterRef = useRef("");
  const pendingCandidates = useRef([]);
  const [state, setState] = useState("waiting");
  const [muted, setMuted] = useState(true);
  const [turn, setTurn] = useState(null);

  useEffect(() => {
    api("/api/streams/config")
      .then((data) => setTurn(data.turn || null))
      .catch(() => {});
  }, []);

  const iceServers = useMemo(() => {
    const servers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
    if (turn?.url) {
      servers.push({ urls: turn.url, username: turn.username, credential: turn.credential });
    }
    return servers;
  }, [turn]);

  useEffect(() => {
    if (!socket) return undefined;
    joinStream(matchId);
    setState("waiting");

    const attach = async (sdp, from) => {
      if (!sdp) return;
      broadcasterRef.current = from;
      peerRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers });
      peerRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams?.[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
        }
        setState("playing");
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit("webrtc:candidate", { to: from, candidate: event.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setState("waiting");
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      pendingCandidates.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, sdp: pc.localDescription });
    };

    const onOffer = ({ from, sdp }) => {
      attach(sdp, from).catch(() => setState("error"));
    };
    const onCandidate = async ({ candidate }) => {
      if (!candidate) return;
      if (peerRef.current?.remoteDescription) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidates.current.push(candidate);
      }
    };
    const onStarted = () => {
      setState("waiting");
      socket.emit("webrtc:viewer-join", { matchId });
    };
    const onEnded = () => {
      setState("ended");
      peerRef.current?.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:candidate", onCandidate);
    socket.on("broadcast:started", onStarted);
    socket.on("broadcast:ended", onEnded);

    socket.emit("webrtc:viewer-join", { matchId });

    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:candidate", onCandidate);
      socket.off("broadcast:started", onStarted);
      socket.off("broadcast:ended", onEnded);
      socket.emit("webrtc:viewer-left", { matchId, viewerId: socket.id });
      peerRef.current?.close();
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, matchId, iceServers]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        poster={poster}
        autoPlay
        playsInline
        muted={muted}
        controls={state === "playing"}
        className="h-full w-full object-contain"
      />
      {state !== "playing" && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-950 to-ink-900 p-6 text-center">
          <div className="max-w-xs">
            {state === "ended" ? (
              <WifiOff size={26} className="mx-auto mb-3 text-white/30" />
            ) : state === "error" ? (
              <AlertCircle size={26} className="mx-auto mb-3 text-coral" />
            ) : (
              <span className="relative mx-auto mb-3 grid h-14 w-14 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-lime/10" />
                <Radio size={26} className="relative text-lime" />
              </span>
            )}
            <p className="text-sm font-semibold text-white/80">
              {state === "ended" ? t("video.cameraEnded") : state === "error" ? t("video.cameraError") : t("video.cameraWaiting")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {state === "waiting" ? t("video.cameraWaitingText") : t("video.cameraRestart")}
            </p>
            {!active && <p className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/45">{t("video.offlineMarked")}</p>}
          </div>
        </div>
      )}
      {state === "playing" && (
        <button
          onClick={() => setMuted((v) => !v)}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white/80 backdrop-blur transition hover:bg-black/80"
          aria-label={muted ? t("video.unmute") : t("video.mute")}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      )}
    </div>
  );
}

function Equalizer({ className = "" }) {
  return (
    <span className={cn("flex h-3 items-end gap-[2px]", className)} aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className="eq-bar h-full w-[3px] rounded-sm bg-coral"
          style={{ animationDelay: `${bar * 120}ms` }}
        />
      ))}
    </span>
  );
}

export default function LiveVideoPlayer({ match, className = "", compact = false, showMeta = true }) {
  const { t } = useI18n();
  const stream = match?.stream || {};
  const mode = stream.mode;
  const live = Boolean(stream.isLive);
  const playback = stream.recordingUrl || "";
  const [playingReplay, setPlayingReplay] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef(null);

  const viewerCount = useMemo(() => Math.max(stream.viewers || 0, 0), [stream.viewers]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    shellRef.current?.requestFullscreen?.().catch(() => {});
  };

  if (!live && !playback) {
    return (
      <div
        ref={shellRef}
        className={cn(
          "video-shell relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-card",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(200,255,61,0.14),transparent_58%)]" />
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="animate-fade-up">
            <span className="relative mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/45">
              <span className="absolute inset-0 animate-ring-pulse rounded-full border border-lime/30" />
              <Radio size={22} className="relative" />
            </span>
            <p className="text-sm font-semibold text-white/75">{t("video.warming")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {t("video.notLive")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canReplay = Boolean(playback);
  const showingReplay = canReplay && !live ? true : playingReplay;
  const isCamera = mode === "camera" && live && !showingReplay;
  const isLiveKit = mode === "livekit" && live && !showingReplay;
  const src = showingReplay ? playback : mode === "hls" ? stream.hlsUrl : "";
  const title = stream.title || `${teamName(match?.teamA)} vs ${teamName(match?.teamB)}`;

  return (
    <div
      ref={shellRef}
      className={cn(
        "video-shell group relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card",
        fullscreen && "h-screen w-screen rounded-none border-0",
        className
      )}
    >
      {stream.thumbnail && !live && (
        <img src={stream.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}

      {showingReplay ? (
        <video src={playback} poster={stream.thumbnail} controls autoPlay playsInline className="h-full w-full object-contain" />
      ) : isLiveKit ? (
        <LiveKitViewer matchId={match._id} active={live} poster={stream.thumbnail} />
      ) : isCamera ? (
        <CameraPlayer matchId={match._id} active={live} poster={stream.thumbnail} />
      ) : mode === "embed" ? (
        <iframe
          src={normalizeEmbed(stream.embedUrl)}
          title={stream.title || t("video.liveCricketStream")}
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <HlsPlayer src={src} poster={stream.thumbnail} />
      )}

      {showMeta && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/30 to-transparent p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {live && !showingReplay ? (
              <LiveBadge label={t("live.liveVideo")} />
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
                <Play size={9} fill="currentColor" /> {t("video.replay")}
              </span>
            )}
            {live && !showingReplay && (
              <>
                <Equalizer />
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/70 backdrop-blur">
                  {t("video.watching", { count: formatNumber(viewerCount) })}
                </span>
              </>
            )}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {live && canReplay && !showingReplay && (
              <button
                type="button"
                onClick={() => setPlayingReplay(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur transition hover:bg-black/80 hover:text-white"
              >
                <Play size={11} fill="currentColor" /> {t("video.replay")}
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-white/75 backdrop-blur transition hover:bg-black/80 hover:text-white"
              aria-label={fullscreen ? t("video.exitFullscreen") : t("video.enterFullscreen")}
              title={fullscreen ? t("video.exitFullscreen") : t("video.fullscreen")}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      )}

      {showMeta && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-white">{title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-medium text-white/50">
                <span className="truncate">{match?.series || t("video.bethubLive")}</span>
                {match?.format && (
                  <>
                    <span className="text-white/25">·</span>
                    <span>{match.format}</span>
                  </>
                )}
                {match?.overs && (
                  <>
                    <span className="text-white/25">·</span>
                    <span>{t("video.overs", { count: match.overs })}</span>
                  </>
                )}
              </p>
            </div>
            {!compact && (
              <span className="shrink-0 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50 backdrop-blur">
                {showingReplay ? t("video.fullReplay") : mode || t("live.video")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayerLinkOverlay({ slug }) {
  if (!slug) return null;
  return (
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white/60">
      <Maximize2 size={11} /> /live/{slug}
    </span>
  );
}
