import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LocalAudioTrack, LocalVideoTrack, Room, RoomEvent } from "livekit-client";
import {
  Activity,
  Camera,
  CameraOff,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  Mic,
  MonitorPlay,
  QrCode,
  Radio,
  RefreshCw,
  Square,
  Tv,
  UploadCloud,
  Users,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, StatusDot } from "./components/AdminUI";
import UploadField from "../components/common/UploadField";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { TeamLogo } from "../components/common/Avatars";
import { LiveBadge, StatusPill } from "../components/common/Badges";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { api, uploadFile } from "../lib/api";
import { cn, copyText, formatBytes, formatNumber, formatSeconds, statusLabel, timeAgo } from "../lib/utils";

const modes = [
  { key: "livekit", label: "LiveKit", icon: Radio, hint: "Publish through a LiveKit room — lower latency and scalable fan delivery" },
  { key: "camera", label: "Camera", icon: Camera, hint: "Broadcast from this device using the legacy WebRTC mesh" },
  { key: "hls", label: "HLS", icon: Wifi, hint: "Paste an .m3u8 stream from your encoder" },
  { key: "embed", label: "Embed", icon: MonitorPlay, hint: "Paste a YouTube or iframe embed URL" },
];

const mimeCandidates = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const buildIceServers = (turn) => {
  const servers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
  const turnUrl = turn?.url || turn?.urls?.[0];
  if (turnUrl) servers.push({ urls: turnUrl, username: turn.username || "", credential: turn.credential || "" });
  return servers;
};

const matchLabel = (match) => `${match.teamA?.shortName || "TBC"} vs ${match.teamB?.shortName || "TBC"}`;

function LiveNowRow({ match, onManage }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.05] px-4 py-3 last:border-0">
      <div className="flex shrink-0 -space-x-1.5">
        <TeamLogo team={match.teamA} size="xs" />
        <TeamLogo team={match.teamB} size="xs" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/80">{matchLabel(match)}</p>
        <p className="flex items-center gap-1.5 text-[9px] text-white/35">
          <span className="inline-flex items-center gap-1 text-coral"><span className="h-1 w-1 animate-pulseDot rounded-full bg-coral" /> LIVE</span>
          <span>·</span>
          <span>{formatNumber(match.stream?.viewers || 0)} watching</span>
          {match.stream?.recording && <span className="text-mint">· REC</span>}
        </p>
      </div>
      <button onClick={() => onManage(match)} className="btn-ghost btn-xs">Manage</button>
    </div>
  );
}

export default function AdminStreams() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("match") || "";
  const { socket } = useSocket();
  const { success, error: toastError, info } = useToast();
  const { data, loading, refetch } = useFetch("/api/matches?limit=150", { poll: 30000 });
  const { data: status, refetch: refetchStatus } = useFetch("/api/streams/recording-status", { poll: 12000 });
  const { data: config } = useFetch("/api/streams/config", { poll: 0 });

  const [selectedId, setSelectedId] = useState(requested);
  const [mode, setMode] = useState("camera");
  const [form, setForm] = useState({ title: "", hlsUrl: "", embedUrl: "", thumbnail: "" });
  const [busy, setBusy] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [livekitState, setLivekitState] = useState("idle");
  const [livekitError, setLivekitError] = useState("");

  const localStreamRef = useRef(null);
  const previewRef = useRef(null);
  const peersRef = useRef(new Map());
  const livekitRoomRef = useRef(null);
  const livekitTracksRef = useRef([]);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartRef = useRef(0);
  const matchIdRef = useRef("");
  const broadcastingRef = useRef(false);
  const recordingRef = useRef(false);
  const uploadNextRef = useRef(true);
  const timerRef = useRef(null);
  const selectedIdRef = useRef("");

  const matches = data?.matches || [];
  const selected = useMemo(() => matches.find((row) => row._id === selectedId) || null, [matches, selectedId]);
  const { data: detailData, refetch: refetchDetail } = useFetch(selectedId ? `/api/matches/${selectedId}` : "", {
    deps: [selectedId],
  });
  const detail = detailData?.match && String(detailData.match._id) === String(selectedId) ? detailData.match : null;
  const stream = detail?.stream || selected?.stream || {};
  const live = Boolean(stream.isLive);
  const limits = status?.limits || config?.limits || {};
  const maxLiveHours = Number(limits.maxLiveHours) || 4;
  const [clockNow, setClockNow] = useState(Date.now());
  const liveWindowLeft = stream.startedAt
    ? Math.max(0, Math.floor((new Date(stream.startedAt).getTime() + maxLiveHours * 3_600_000 - clockNow) / 1000))
    : null;
  const livekitConfig = config?.livekit || {};
  const livekitEnabled = Boolean(livekitConfig.enabled);
  const iceServers = useMemo(() => buildIceServers(config?.turn), [config?.turn]);
  const liveUrl = stream.playbackUrl || (stream.slug ? `${window.location.origin}/live/${stream.slug}` : "");

  matchIdRef.current = selected?._id || "";
  selectedIdRef.current = selectedId || "";

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId && requested) setSelectedId(requested);
  }, [requested, selectedId]);

  useEffect(() => {
    if (!selectedId && matches.length) setSelectedId(matches[0]._id);
  }, [matches, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setMode("camera");
    setForm({
      title: stream.title || `${selected.teamA?.shortName || ""} vs ${selected.teamB?.shortName || ""}`.trim(),
      hlsUrl: "",
      embedUrl: "",
      thumbnail: stream.thumbnail || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id]);

  useEffect(() => {
    if (!detail) return;
    setMode(detail.stream?.mode || "camera");
    setForm({
      title: detail.stream?.title || `${detail.teamA?.shortName || ""} vs ${detail.teamB?.shortName || ""}`.trim(),
      hlsUrl: detail.stream?.hlsUrl || "",
      embedUrl: detail.stream?.embedUrl || "",
      thumbnail: detail.stream?.thumbnail || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?._id]);

  /* ── camera preview ─────────────────────────────────────────── */
  const attachPreview = (media) => {
    if (previewRef.current) previewRef.current.srcObject = media || null;
  };

  const stopCamera = () => {
    const media = localStreamRef.current;
    localStreamRef.current = null;
    media?.getTracks().forEach((track) => track.stop());
    attachPreview(null);
    setCameraState("idle");
  };

  /* ── LiveKit broadcaster ────────────────────────────────────── */
  const stopLiveKit = async () => {
    const room = livekitRoomRef.current;
    livekitRoomRef.current = null;
    const tracks = livekitTracksRef.current;
    livekitTracksRef.current = [];
    for (const track of tracks) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    }
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setLivekitState("idle");
  };

  const startLiveKitBroadcast = async (match, media) => {
    if (!match || !media) return { ok: false, error: "Camera is not ready" };
    setLivekitState("connecting");
    setLivekitError("");
    try {
      const token = await api(`/api/streams/${match._id}/livekit/token`, {
        method: "POST",
        body: { role: "host" },
      });
      const room = new Room({ adaptiveStream: true, dynacast: true });
      livekitRoomRef.current = room;
      room.on(RoomEvent.Reconnecting, () => setLivekitState("connecting"));
      room.on(RoomEvent.Reconnected, () => setLivekitState("live"));
      room.on(RoomEvent.Disconnected, () => setLivekitState("idle"));
      await room.connect(token.url, token.token);

      const tracks = [];
      const videoTrack = media.getVideoTracks()[0];
      const audioTrack = media.getAudioTracks()[0];
      if (videoTrack) tracks.push(new LocalVideoTrack(videoTrack));
      if (audioTrack) tracks.push(new LocalAudioTrack(audioTrack));
      for (const track of tracks) await room.localParticipant.publishTrack(track);
      livekitTracksRef.current = tracks;
      setLivekitState("live");
      return { ok: true };
    } catch (err) {
      const message = err?.message || "LiveKit could not publish the camera";
      setLivekitError(message);
      await stopLiveKit();
      return { ok: false, error: message };
    }
  };

  const openCamera = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a camera. Use HTTPS or localhost.");
      setCameraState("error");
      return null;
    }
    setCameraState("requesting");
    setCameraError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      localStreamRef.current = media;
      attachPreview(media);
      setCameraState("ready");
      return media;
    } catch (err) {
      setCameraState("error");
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow access in your browser and try again."
          : err?.name === "NotFoundError"
            ? "No camera was found on this device."
            : err?.message || "Could not open the camera."
      );
      return null;
    }
  };

  /* ── WebRTC broadcaster ─────────────────────────────────────── */
  const closePeers = () => {
    for (const peer of peersRef.current.values()) {
      try {
        peer.pc.close();
      } catch {
        /* ignore */
      }
    }
    peersRef.current.clear();
    setViewerCount(0);
  };

  const createOffer = async (viewerId) => {
    const media = localStreamRef.current;
    if (!socket || !media) return;
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers });
    const entry = { pc, pending: [] };
    peersRef.current.set(viewerId, entry);
    setViewerCount(peersRef.current.size);

    media.getTracks().forEach((track) => pc.addTrack(track, media));
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("webrtc:candidate", { to: viewerId, candidate: event.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(viewerId);
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { to: viewerId, sdp: pc.localDescription, matchId: matchIdRef.current });
      info("A viewer connected to your camera feed");
    } catch (err) {
      closePeer(viewerId);
      toastError(err.message || "Could not connect that viewer");
    }
  };

  const closePeer = (viewerId) => {
    const entry = peersRef.current.get(viewerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {
      /* ignore */
    }
    peersRef.current.delete(viewerId);
    setViewerCount(peersRef.current.size);
  };

  useSocketEvent("webrtc:viewer-join", ({ matchId, viewerId }) => {
    if (!broadcastingRef.current || !viewerId) return;
    if (String(matchId) !== String(matchIdRef.current)) return;
    createOffer(viewerId);
  });

  useSocketEvent("webrtc:answer", async ({ from, sdp }) => {
    const entry = peersRef.current.get(from);
    if (!entry || !sdp) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of entry.pending) {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      entry.pending = [];
    } catch {
      closePeer(from);
    }
  });

  useSocketEvent("webrtc:candidate", async ({ from, candidate }) => {
    const entry = peersRef.current.get(from);
    if (!entry || !candidate) return;
    if (entry.pc.remoteDescription) {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      entry.pending.push(candidate);
    }
  });

  useSocketEvent("webrtc:viewer-left", ({ viewerId }) => {
    if (viewerId) closePeer(viewerId);
  });

  const startBroadcastSignal = () =>
    new Promise((resolve) => {
      if (!socket) return resolve(false);
      broadcastingRef.current = true;
      const timer = setTimeout(() => resolve(true), 2500);
      socket.emit("broadcast:start", { matchId: matchIdRef.current }, () => {
        clearTimeout(timer);
        resolve(true);
      });
      return true;
    });

  const stopBroadcastSignal = () => {
    if (!socket || !broadcastingRef.current) return;
    broadcastingRef.current = false;
    socket.emit("broadcast:stop", { matchId: matchIdRef.current });
    closePeers();
  };

  /* ── recording ──────────────────────────────────────────────── */
  const clearRecordTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const cancelServerRecording = () => {
    const id = matchIdRef.current;
    if (id) api(`/api/streams/${id}/recording/cancel`, { method: "POST", body: {} }).catch(() => {});
  };

  const uploadRecording = async (blob, seconds) => {
    const id = matchIdRef.current;
    if (!id) return;
    const maxMb = Number(limits.maxVideoMb) || 200;
    if (blob.size > maxMb * 1024 * 1024) {
      toastError(`Recording is ${formatBytes(blob.size)} — the limit is ${maxMb} MB`);
      cancelServerRecording();
      setRecording(false);
      recordingRef.current = false;
      return;
    }
    setUploadProgress(0);
    setBusy("upload");
    try {
      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `bethub-replay-${Date.now()}.${extension}`, { type: blob.type || "video/webm" });
      const result = await uploadFile(`/api/streams/${id}/recording/finish`, file, {
        fields: {
          duration: String(seconds),
          title: form.title ? `${form.title} · replay` : "",
        },
        onProgress: setUploadProgress,
      });
      success(`Replay saved${result?.video?.duration ? ` · ${formatSeconds(result.video.duration)}` : ""}`);
      await Promise.allSettled([refetch(true), refetchStatus(true), refetchDetail(true)]);
    } catch (err) {
      cancelServerRecording();
      toastError(err.message || "The replay could not be uploaded");
      await refetchStatus(true);
    } finally {
      setUploadProgress(-1);
      setBusy("");
      setRecording(false);
      recordingRef.current = false;
      setRecordSeconds(0);
    }
  };

  const startRecording = async () => {
    const media = localStreamRef.current;
    if (!media) {
      toastError("Open the camera before recording");
      return;
    }
    if (recordingRef.current) return;
    const mime = pickMime();
    if (!mime && typeof MediaRecorder === "undefined") {
      toastError("This browser cannot record video");
      return;
    }
    setBusy("record");
    try {
      await api(`/api/streams/${matchIdRef.current}/recording/start`, { method: "POST", body: {} });
      const recorder = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      chunksRef.current = [];
      uploadNextRef.current = true;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearRecordTimer();
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        recordingRef.current = false;
        setRecordSeconds(0);
        if (uploadNextRef.current) uploadRecording(blob, seconds);
        else cancelServerRecording();
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
      setRecordSeconds(0);
      clearRecordTimer();
      timerRef.current = setInterval(() => {
        setRecordSeconds(Math.max(0, Math.round((Date.now() - recordingStartRef.current) / 1000)));
      }, 1000);
      success("Recording started — it will become a replay when you stop");
    } catch (err) {
      toastError(err.message || "Could not start recording");
    } finally {
      setBusy("");
    }
  };

  const stopRecording = (save = true) => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    uploadNextRef.current = save;
    try {
      recorder.stop();
    } catch {
      setRecording(false);
      recordingRef.current = false;
    }
    if (!save) info("Recording discarded");
  };

  useEffect(() => {
    return () => {
      clearRecordTimer();
      if (recorderRef.current) {
        uploadNextRef.current = false;
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
      }
      if (recordingRef.current) cancelServerRecording();
      if (broadcastingRef.current) {
        broadcastingRef.current = false;
        socket?.emit("broadcast:stop", { matchId: matchIdRef.current });
      }
      closePeers();
      stopLiveKit();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (!live && livekitState === "live") stopLiveKit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  /* ── actions ────────────────────────────────────────────────── */
  const goLive = async () => {
    if (!selected) return;
    const payload = {
      mode,
      title: form.title.trim(),
      hlsUrl: form.hlsUrl.trim(),
      embedUrl: form.embedUrl.trim(),
      thumbnail: form.thumbnail || "",
    };
    if (mode === "hls" && !payload.hlsUrl) return toastError("Paste the HLS .m3u8 URL first");
    if (mode === "embed" && !payload.embedUrl) return toastError("Paste the embed URL first");

    setBusy("live");
    try {
      let media = null;
      if (mode === "camera" || mode === "livekit") {
        media = await openCamera();
        if (!media) {
          setBusy("");
          return;
        }
      }
      const result = await api(`/api/streams/${selected._id}/go-live`, { method: "POST", body: payload });
      if (mode === "livekit") {
        const published = await startLiveKitBroadcast(selected, media);
        if (!published.ok) {
          await api(`/api/streams/${selected._id}/end-live`, { method: "POST", body: {} }).catch(() => {});
          stopCamera();
          await Promise.allSettled([refetch(true), refetchStatus(true), refetchDetail(true)]);
          toastError(published.error || "LiveKit could not publish — the stream was stopped");
          return;
        }
      }
      if (mode === "camera") await startBroadcastSignal();
      await Promise.allSettled([refetch(true), refetchStatus(true), refetchDetail(true)]);
      success(`${matchLabel(selected)} is live — ${result?.stream?.playbackUrl ? "share the link below" : "broadcast started"}`);
      setParams({ match: selected._id }, { replace: true });
    } catch (err) {
      toastError(err.message || "Could not go live");
      if (mode !== "camera" && mode !== "livekit") stopCamera();
    } finally {
      setBusy("");
    }
  };

  const endLive = async () => {
    if (!selected) return;
    if (recordingRef.current || stream.recording) return toastError("Stop the recording before ending the live stream");
    setBusy("end");
    try {
      stopBroadcastSignal();
      await stopLiveKit();
      await api(`/api/streams/${selected._id}/end-live`, { method: "POST", body: {} });
      stopCamera();
      setConfirmEnd(false);
      await Promise.allSettled([refetch(true), refetchStatus(true), refetchDetail(true)]);
      success("Live stream ended — the replay is still available if you recorded it");
    } catch (err) {
      toastError(err.message || "Could not end the stream");
    } finally {
      setBusy("");
    }
  };

  const openQr = async () => {
    if (!selected) return;
    try {
      const result = await api(`/api/streams/${selected._id}/qr`);
      setQr(result);
    } catch (err) {
      toastError(err.message || "Go live first to generate a QR code");
    }
  };

  const copyLink = async (value) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      success("Live link copied — share it anywhere");
      setTimeout(() => setCopied(false), 1800);
    } else {
      toastError("Could not copy the link");
    }
  };

  const manage = (match) => {
    setSelectedId(match._id);
    setParams({ match: match._id }, { replace: true });
  };

  const refreshAll = () => Promise.allSettled([refetch(true), refetchStatus(true), refetchDetail(true)]);

  if (loading && !data) return <PageLoader label="Opening the broadcast desk…" />;

  const liveMatches = matches.filter((row) => row.stream?.isLive);
  const modeInfo = modes.find((row) => row.key === mode);

  return (
    <AdminPage
      eyebrow="Broadcast desk"
      title="Live streams"
      subtitle="Go live from a camera, an HLS encoder or an embed, record a replay and share one automatic link."
      actions={
        <>
          <button onClick={refreshAll} className="btn-ghost btn-xs"><RefreshCw size={12} /> Refresh</button>
          <Link to="/live" className="btn-primary btn-xs"><Radio size={12} /> Live centre</Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Radio} label="On air" value={status?.live ?? liveMatches.length} hint={`max ${limits.maxLiveMatches || 10} matches`} accent="text-coral" />
        <StatCard icon={Video} label="Recording" value={status?.recording || 0} hint={`max ${limits.maxRecordings || 5} at once`} accent="text-mint" />
        <StatCard icon={Users} label="Watching" value={formatNumber(status?.viewers || 0)} hint="across every ground" accent="text-lime" />
        <StatCard icon={Tv} label="Video ready" value={liveMatches.length} hint="streams configured today" accent="text-sky" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="1 · Pick a match" subtitle="Every fixture on Bethub, live or not">
            <Field label="Match" hint="The automatic live link belongs to this fixture">
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setParams({ match: event.target.value }, { replace: true });
                }}
                className="input"
              >
                {matches.map((match) => (
                  <option key={match._id} value={match._id} className="bg-ink-900">
                    {matchLabel(match)} · {match.series} · {statusLabel(match.status)}
                  </option>
                ))}
              </select>
            </Field>

            {selected ? (
              <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex shrink-0 -space-x-1.5">
                    <TeamLogo team={selected.teamA} size="sm" />
                    <TeamLogo team={selected.teamB} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/85">{matchLabel(selected)}</p>
                    <p className="truncate text-[10px] text-white/35">{selected.series} · {selected.format} · {selected.venue || "Venue TBC"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusPill status={selected.status} />
                    {live && <LiveBadge label="ON AIR" />}
                  </div>
                </div>
                {selected.status === "finished" && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1.5 text-[10px] text-amber-200/75">
                    <Info size={11} className="mt-0.5 shrink-0" /> This match has finished. Its replay and link stay available, but you cannot start a new live stream.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/35">
                No matches yet — create a fixture first.
              </p>
            )}
          </Panel>

          <Panel title={live ? "Stream is on air" : "2 · Choose a source"} subtitle={live ? "The page is broadcasting to every viewer in realtime" : modeInfo?.hint}>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setMode(row.key)}
                  disabled={live || (row.key === "livekit" && !livekitEnabled)}
                  title={row.key === "livekit" && !livekitEnabled ? "Add LiveKit keys on the server to enable this mode" : row.hint}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-center transition disabled:cursor-not-allowed",
                    mode === row.key ? "border-lime/40 bg-lime/10 text-lime" : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/20 hover:text-white",
                    row.key === "livekit" && !livekitEnabled && "opacity-40"
                  )}
                >
                  <row.icon size={17} className="mx-auto mb-1.5" />
                  <span className="block text-[11px] font-semibold">{row.label}</span>
                  {live && stream.mode === row.key && <span className="mt-0.5 block text-[8px] uppercase tracking-wider text-lime/70">live</span>}
                  {row.key === "livekit" && !livekitEnabled && <span className="mt-0.5 block text-[8px] uppercase tracking-wider text-white/25">keys needed</span>}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-3">
              {mode === "livekit" && !livekitEnabled && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  Add <code className="mx-1">LIVEKIT_URL</code>, <code className="mx-1">LIVEKIT_API_KEY</code> and <code className="mx-1">LIVEKIT_API_SECRET</code> to the backend, then restart to enable LiveKit rooms.
                </p>
              )}
              {mode === "livekit" && livekitEnabled && (
                <p className="flex items-center gap-1.5 rounded-lg border border-lime/15 bg-lime/[0.05] px-2.5 py-1.5 text-[10px] text-white/55">
                  <Radio size={11} className="text-lime" /> LiveKit room server · <span className="font-mono text-white/40">{livekitConfig.url || "configured"}</span>
                </p>
              )}
              <Field label="Stream title" hint="Shown on the live page and match cards">
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="input" placeholder="e.g. Nepal vs India · Live from Kirtipur" disabled={live} />
              </Field>

              {mode === "hls" && (
                <Field label="HLS URL" required hint="Your encoder's .m3u8 playlist — OBS, Mux, Cloudflare Stream, etc.">
                  <input value={form.hlsUrl} onChange={(event) => setForm({ ...form, hlsUrl: event.target.value })} className="input font-mono text-xs" placeholder="https://…/playlist.m3u8" disabled={live} />
                </Field>
              )}

              {mode === "embed" && (
                <Field label="Embed URL" required hint="YouTube, Twitch or any iframe-friendly player URL">
                  <input value={form.embedUrl} onChange={(event) => setForm({ ...form, embedUrl: event.target.value })} className="input font-mono text-xs" placeholder="https://www.youtube.com/embed/…" disabled={live} />
                </Field>
              )}

              <UploadField
                label="Stream thumbnail"
                value={form.thumbnail ? { url: form.thumbnail } : null}
                onChange={(media) => setForm({ ...form, thumbnail: media?.url || "" })}
                folder="thumbnails"
                hint="Optional poster shown before the stream starts"
              />

              {(mode === "camera" || mode === "livekit") && (
                <div className="space-y-2">
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black">
                    <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    {cameraState !== "ready" && (
                      <div className="absolute inset-0 grid place-items-center bg-ink-950/80 p-4 text-center">
                        <div>
                          {cameraState === "requesting" ? <Loader2 size={22} className="mx-auto mb-2 animate-spin text-lime" /> : <Camera size={22} className="mx-auto mb-2 text-white/30" />}
                          <p className="text-[11px] font-semibold text-white/70">
                            {cameraState === "requesting" ? "Connecting the camera…" : cameraState === "error" ? "Camera unavailable" : "Camera preview"}
                          </p>
                          <p className="mt-1 max-w-[260px] text-[10px] leading-relaxed text-white/35">
                            {cameraState === "error"
                              ? cameraError
                              : mode === "livekit"
                                ? "The preview stays on this device. LiveKit publishes it to every viewer through its SFU."
                                : "The preview stays on this device. Viewers receive it peer-to-peer through WebRTC."}
                          </p>
                          <button type="button" onClick={openCamera} className="btn-ghost btn-xs mt-2" disabled={cameraState === "requesting" || live}>
                            <Camera size={11} /> {cameraState === "ready" ? "Reconnect" : "Test camera"}
                          </button>
                        </div>
                      </div>
                    )}
                    {cameraState === "ready" && (
                      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[9px] font-semibold text-white/65">
                        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulseDot bg-coral" : "bg-mint")} />
                        {live ? "ON AIR" : "PREVIEW"}
                        <span className="text-white/25">·</span>
                        <Mic size={9} /> local
                        {mode === "livekit" && (
                          <>
                            <span className="text-white/25">·</span>
                            <span className={livekitState === "live" ? "text-lime" : livekitState === "connecting" ? "text-amber-300" : "text-white/40"}>
                              {livekitState === "live" ? "LIVEKIT LIVE" : livekitState === "connecting" ? "LIVEKIT…" : "LIVEKIT IDLE"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {broadcastingRef.current && (
                    <p className="flex items-center justify-between rounded-lg border border-lime/15 bg-lime/[0.05] px-2.5 py-1.5 text-[10px] text-white/55">
                      <span className="inline-flex items-center gap-1.5"><Activity size={11} className="text-lime" /> {viewerCount} peer connection{viewerCount === 1 ? "" : "s"}</span>
                      <span className="text-lime">Broadcasting</span>
                    </p>
                  )}
                  {livekitState === "live" && (
                    <p className="flex items-center justify-between rounded-lg border border-lime/15 bg-lime/[0.05] px-2.5 py-1.5 text-[10px] text-white/55">
                      <span className="inline-flex items-center gap-1.5"><Radio size={11} className="text-lime" /> LiveKit room publishing</span>
                      <span className="text-lime">Connected</span>
                    </p>
                  )}
                  {livekitError && mode === "livekit" && (
                    <p className="text-[10px] text-coral">{livekitError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
              {!live ? (
                <button onClick={goLive} className="btn-primary" disabled={Boolean(busy) || !selected || selected.status === "finished"}>
                  {busy === "live" ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
                  {busy === "live" ? "Going live…" : `Go live · ${modes.find((row) => row.key === mode)?.label || mode}`}
                </button>
              ) : (
                <>
                  <button onClick={() => setConfirmEnd(true)} className="btn-danger" disabled={Boolean(busy) || recording || stream.recording}>
                    <Square size={13} /> End live
                  </button>
                  <Link to={`/live/${stream.slug}`} target="_blank" className="btn-ghost"><ExternalLink size={13} /> Open live page</Link>
                </>
              )}
              <button onClick={refreshAll} className="btn-ghost" disabled={Boolean(busy)}><RefreshCw size={13} /> Sync state</button>
            </div>
            {live && (recording || stream.recording) && (
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-200/70"><Info size={11} className="mt-0.5 shrink-0" /> Stop the recording to end the stream. Your replay will be uploaded first.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Broadcast status" subtitle="Enforced by the Bethub realtime server" bodyClassName="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/75">
                {live ? <span className="h-2 w-2 animate-pulseDot rounded-full bg-coral" /> : <WifiOff size={13} className="text-white/30" />}
                {live ? `Live in ${stream.mode} mode` : "Offline"}
              </span>
              <span className="font-mono text-[11px] text-white/45">{formatNumber(stream.viewers || 0)} watching</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <p className="text-white/25">Started</p>
                <p className="mt-0.5 font-semibold text-white/65">{stream.startedAt ? timeAgo(stream.startedAt) : "—"}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <p className="text-white/25">Total views</p>
                <p className="mt-0.5 font-mono font-semibold text-white/65">{formatNumber(stream.totalViews || 0)}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-white/25">Live window</p>
                  <p className={cn("font-mono font-semibold", liveWindowLeft !== null && liveWindowLeft <= 0 ? "text-coral" : "text-amber-200/80")}>
                    {live && liveWindowLeft !== null
                      ? liveWindowLeft <= 0
                        ? "limit reached"
                        : `${formatSeconds(liveWindowLeft)} left`
                      : `${maxLiveHours}h max`}
                  </p>
                </div>
                <p className="mt-0.5 text-[9px] text-white/25">Auto-ends at {maxLiveHours}h · editable in Admin → Settings</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]"><span className="text-white/40">Live matches</span><span className="font-mono text-white/65">{status?.live || 0} / {limits.maxLiveMatches || 10}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-lime" style={{ width: `${Math.min(100, ((status?.live || 0) / (limits.maxLiveMatches || 10)) * 100)}%` }} /></div>
              <div className="flex items-center justify-between text-[10px]"><span className="text-white/40">Concurrent recordings</span><span className="font-mono text-white/65">{status?.recording || 0} / {limits.maxRecordings || 5}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, ((status?.recording || 0) / (limits.maxRecordings || 5)) * 100)}%` }} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[10px] text-white/35">
              <StatusDot active={Boolean(live)} label="Realtime encoder" />
              <StatusDot active={Boolean(socket?.connected)} label="Socket link" />
              <StatusDot active={Boolean((status?.recording || 0) > 0)} label="Recorder" />
            </div>
          </Panel>

          <Panel title="Share the live link" subtitle="Auto-generated — no setup required">
            {stream.slug ? (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-lime/20 bg-lime/[0.05] px-3 py-2">
                  <Link2 size={14} className="shrink-0 text-lime" />
                  <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/65">{liveUrl || `/live/${stream.slug}`}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => copyLink(liveUrl || `${window.location.origin}/live/${stream.slug}`)} className="btn-ghost btn-xs">
                    {copied ? <Check size={12} className="text-mint" /> : <Copy size={12} />} {copied ? "Copied" : "Copy link"}
                  </button>
                  <button onClick={openQr} className="btn-ghost btn-xs"><QrCode size={12} /> QR code</button>
                  <Link to={`/live/${stream.slug}`} target="_blank" className="btn-ghost btn-xs"><ExternalLink size={12} /> Open</Link>
                  <button onClick={() => copyLink(`<iframe src="${liveUrl || `${window.location.origin}/live/${stream.slug}`}" allowfullscreen></iframe>`)} className="btn-ghost btn-xs"><Clipboard size={12} /> Embed code</button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/30">
                  The same link works while live and later as a replay. Finished matches show <b className="text-white/50">Finished</b>, never a fake LIVE badge.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center">
                <Link2 size={18} className="mx-auto mb-2 text-white/20" />
                <p className="text-xs text-white/45">Go live to generate the automatic link</p>
                <p className="mt-1 text-[10px] text-white/25">A permanent slug is created for this fixture.</p>
              </div>
            )}
          </Panel>

          <Panel
            title="Recording & replay"
            subtitle="Captured from the camera feed, stored on Cloudinary"
            action={recording ? <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/15 px-2 py-1 text-[9px] font-bold text-coral"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" /> REC {formatSeconds(recordSeconds)}</span> : null}
          >
            {stream.recordingUrl && !recording ? (
              <div className="mb-3 rounded-lg border border-mint/20 bg-mint/[0.06] px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-mint"><Video size={12} /> Replay ready</p>
                <p className="mt-0.5 text-[10px] text-white/40">{formatSeconds(stream.recordingDuration || 0)} · {formatBytes(stream.recordingBytes || 0)}</p>
                <Link to={`/live/${stream.slug}`} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-lime hover:underline">Watch the replay <ExternalLink size={10} /></Link>
              </div>
            ) : null}

            {uploadProgress >= 0 ? (
              <div>
                <p className="mb-1 flex justify-between text-[10px] text-white/45"><span className="inline-flex items-center gap-1.5"><UploadCloud size={11} className="text-lime" /> Uploading replay to Cloudinary…</span><span className="font-mono text-lime">{uploadProgress}%</span></p>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-lime transition-all" style={{ width: `${uploadProgress}%` }} /></div>
                <p className="mt-1 text-[9px] text-white/25">Keep this tab open. Large files can take a minute.</p>
              </div>
            ) : recording || stream.recording ? (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-white/50">Recording the camera feed. Stop to turn it into a match replay automatically.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => stopRecording(true)} className="btn-primary btn-xs" disabled={!recording}><Square size={11} /> Stop &amp; save replay</button>
                  <button onClick={() => stopRecording(false)} className="btn-danger btn-xs" disabled={!recording}>Discard</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-white/50">
                  {live && (stream.mode === "camera" || stream.mode === "livekit")
                    ? "Start recording to save a full replay. Up to " + (limits.maxVideoMb || 200) + " MB, stored permanently on Cloudinary."
                    : "Recording is available on camera or LiveKit streams. Go live with the host camera to enable it."}
                </p>
                <button onClick={startRecording} className="btn-primary btn-xs" disabled={!live || !["camera", "livekit"].includes(stream.mode) || !localStreamRef.current || Boolean(busy)}>
                  <Video size={11} /> Start recording
                </button>
                <p className="text-[9px] text-white/25">{status?.recording || 0} of {limits.maxRecordings || 5} concurrent recordings in use · max {limits.maxVideoMb || 200} MB each</p>
              </div>
            )}
          </Panel>

          <Panel title="Live now" subtitle="Every ground currently on air" bodyClassName="!p-0">
            {liveMatches.length ? (
              liveMatches.map((match) => <LiveNowRow key={match._id} match={match} onManage={manage} />)
            ) : (
              <div className="px-4 py-7 text-center">
                <EmptyState icon={<CameraOff size={18} />} title="Nothing on air" text="Pick a match and go live to start broadcasting." />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={Boolean(qr)}
        onClose={() => setQr(null)}
        title="Scan to watch"
        subtitle="Point a phone camera at this code"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setQr(null)} className="btn-ghost">Close</button>
            <button onClick={() => copyLink(qr?.url || liveUrl)} className="btn-primary"><Copy size={13} /> Copy link</button>
          </div>
        }
      >
        {qr?.qr ? (
          <div className="text-center">
            <img src={qr.qr} alt="Live stream QR code" className="mx-auto w-full max-w-[260px] rounded-xl bg-white p-3" />
            <p className="mt-3 break-all font-mono text-[10px] text-white/45">{qr.url || liveUrl}</p>
          </div>
        ) : (
          <PageLoader label="Drawing the QR code…" />
        )}
      </Modal>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => (busy ? null : setConfirmEnd(false))}
        onConfirm={endLive}
        title="End this live stream?"
        text="Viewers will see the stream as finished. A saved replay stays available on the same link. You can go live again later."
        confirmLabel="End live"
        danger
        loading={busy === "end"}
      />
    </AdminPage>
  );
}
