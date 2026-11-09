import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { AlertCircle, Loader2, Radio, RefreshCw, Volume2, VolumeX, WifiOff } from "lucide-react";
import { api } from "../lib/api";

/**
 * LiveKit subscriber. It requests a short-lived viewer token from the Bethub
 * API, joins the match room and attaches the host's camera + microphone.
 */
export default function LiveKitViewer({ matchId, active, poster, className = "" }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const roomRef = useRef(null);
  const [state, setState] = useState(active ? "connecting" : "waiting");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      setState("waiting");
      return undefined;
    }
    let cancelled = false;
    let room;
    setState("connecting");
    setError("");

    const attachPublication = (publication) => {
      const track = publication?.track;
      if (!track) return;
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        setState("playing");
      }
      if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
      }
    };

    const connect = async () => {
      const tokenData = await api(`/api/streams/${matchId}/livekit/token`, {
        method: "POST",
        body: { role: "viewer", name: `Fan ${Math.floor(1000 + Math.random() * 9000)}` },
        auth: false,
      });
      if (cancelled) return;
      room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setState("playing");
        }
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (track.kind === Track.Kind.Video) setState("waiting");
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (room.remoteParticipants.size === 0) setState("waiting");
      });
      room.on(RoomEvent.Reconnecting, () => setState("reconnecting"));
      room.on(RoomEvent.Reconnected, () => setState("playing"));
      room.on(RoomEvent.Disconnected, () => setState("ended"));

      await room.connect(tokenData.url, tokenData.token, { autoSubscribe: true });
      if (cancelled) return;

      // Autoplay-friendly: video starts muted; the viewer can unmute.
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => attachPublication(publication));
      });
      if (room.remoteParticipants.size === 0) setState("waiting");
    };

    connect().catch((err) => {
      if (cancelled) return;
      setError(err?.message || "Could not join the LiveKit room");
      setState("error");
    });

    return () => {
      cancelled = true;
      roomRef.current = null;
      room?.disconnect().catch(() => {});
    };
  }, [matchId, active, attempt]);

  const retry = () => setAttempt((value) => value + 1);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <video ref={videoRef} poster={poster} autoPlay playsInline muted={muted} controls={state === "playing"} className="h-full w-full object-contain" />
      <audio ref={audioRef} autoPlay muted={muted} className="hidden" />

      {state === "playing" && (
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white/80 backdrop-blur transition hover:bg-black/80"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      )}

      {state !== "playing" && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-950 to-ink-900 p-6 text-center">
          <div className="max-w-xs">
            {state === "error" ? (
              <AlertCircle size={26} className="mx-auto mb-3 text-coral" />
            ) : state === "ended" ? (
              <WifiOff size={26} className="mx-auto mb-3 text-white/30" />
            ) : (
              <span className="relative mx-auto mb-3 grid h-14 w-14 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-lime/10" />
                <Loader2 size={24} className="relative animate-spin text-lime" />
              </span>
            )}
            <p className="text-sm font-semibold text-white/80">
              {state === "error"
                ? "LiveKit could not connect"
                : state === "ended"
                  ? "LiveKit broadcast ended"
                  : state === "reconnecting"
                    ? "Reconnecting to LiveKit…"
                    : "Waiting for the LiveKit host…"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {state === "error"
                ? error
                : state === "waiting"
                  ? "The host is connecting the camera. This page will start automatically."
                  : "Keep this page open — the stream resumes as soon as the host is back."}
            </p>
            {(state === "error" || state === "ended") && (
              <button type="button" onClick={retry} className="btn-ghost btn-xs mt-3">
                <RefreshCw size={11} /> Try again
              </button>
            )}
            {state === "waiting" && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/45">
                <Radio size={11} className="text-lime" /> LiveKit room ready
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
