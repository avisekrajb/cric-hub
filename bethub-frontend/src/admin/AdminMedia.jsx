import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Eye,
  Film,
  HardDrive,
  Heart,
  Loader2,
  Play,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard } from "./components/AdminUI";
import ConfirmDialog from "../components/common/ConfirmDialog";
import Tabs from "../components/common/Tabs";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useToast } from "../contexts/ToastContext";
import { uploadVideo } from "../lib/api";
import { api } from "../lib/api";
import { cn, formatBytes, formatDate, formatNumber, formatSeconds } from "../lib/utils";

const types = [
  { key: "short", label: "Short" },
  { key: "long", label: "Long form" },
  { key: "highlight", label: "Highlight" },
  { key: "replay", label: "Replay" },
];

const typeStyle = {
  short: "bg-lime/15 text-lime",
  long: "bg-sky/15 text-sky",
  highlight: "bg-mint/15 text-mint",
  replay: "bg-amber-400/15 text-amber-200",
};

const emptyForm = () => ({ title: "", description: "", type: "highlight", matchId: "" });

export default function AdminMedia() {
  const { data, loading, refetch } = useFetch("/api/media/videos?limit=100", { poll: 60000 });
  const { data: summaryData, refetch: refetchSummary } = useFetch("/api/media/summary", { poll: 60000 });
  const { data: matchData } = useFetch("/api/matches?limit=150");
  const { success, error: toastError } = useToast();

  const fileRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const videos = data?.videos || [];
  const summary = summaryData?.summary || {};
  const limits = summaryData?.limits || {};
  const matches = matchData?.matches || [];

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return videos.filter((video) => {
      if (tab !== "all" && video.type !== tab) return false;
      if (!term) return true;
      return `${video.title} ${video.description} ${video.match?.series || ""}`.toLowerCase().includes(term);
    });
  }, [videos, tab, search]);

  const reset = () => {
    setForm(emptyForm());
    setFile(null);
    setDuration(0);
    setProgress(-1);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const pickFile = (picked) => {
    if (!picked) return;
    const maxMb = Number(limits.maxVideoMb) || 200;
    if (!picked.type.startsWith("video/")) {
      toastError("Choose a video file (MP4, WebM or MOV)");
      return;
    }
    if (picked.size > maxMb * 1024 * 1024) {
      toastError(`That file is ${formatBytes(picked.size)} — the limit is ${maxMb} MB`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(picked);
    setFile(picked);
    setPreviewUrl(url);
    setDuration(0);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(Math.round(probe.duration));
      probe.removeAttribute("src");
    };
    probe.onerror = () => probe.removeAttribute("src");
    if (!form.title) {
      setForm((current) => ({ ...current, title: picked.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }));
    }
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file) {
      toastError("Choose a video file to upload");
      return;
    }
    if (!form.title.trim()) {
      toastError("Give the video a title");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const video = await uploadVideo(
        file,
        {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          matchId: form.matchId,
          duration: duration || "",
        },
        setProgress
      );
      success(`${video.title} uploaded${video.bytes ? ` · ${formatBytes(video.bytes)}` : ""}`);
      reset();
      await Promise.allSettled([refetch(true), refetchSummary(true)]);
    } catch (err) {
      toastError(err.message || "The video could not be uploaded");
      setProgress(-1);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await api(`/api/media/videos/${confirm._id}`, { method: "DELETE" });
      success("Video deleted from Cloudinary and Bethub");
      setConfirm(null);
      await Promise.allSettled([refetch(true), refetchSummary(true)]);
    } catch (err) {
      toastError(err.message || "Could not delete the video");
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !data) return <PageLoader label="Opening the media library…" />;

  const totalVideos = Object.values(summary).reduce((sum, value) => sum + (Number(value) || 0), 0);

  return (
    <AdminPage
      eyebrow="Cloudinary library"
      title="Media"
      subtitle={`Upload shorts and long-form cricket videos up to ${limits.maxVideoMb || 200} MB. Everything is stored on Cloudinary and streamed back through Bethub.`}
      actions={
        <button onClick={() => fileRef.current?.click()} className="btn-ghost btn-xs">
          <UploadCloud size={12} /> Choose file
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Film} label="Videos" value={formatNumber(totalVideos)} hint={`${summary.short || 0} shorts · ${summary.long || 0} long`} accent="text-lime" />
        <StatCard icon={Eye} label="Views" value={formatNumber(summaryData?.views || 0)} hint="across the library" accent="text-sky" />
        <StatCard icon={HardDrive} label="Stored" value={formatBytes(summaryData?.bytes || 0)} hint="on Cloudinary" accent="text-mint" />
        <StatCard icon={Video} label="Highlights" value={formatNumber((summary.highlight || 0) + (summary.replay || 0))} hint="highlights & replays" accent="text-white/60" />
      </div>

      <Panel title="Upload a video" subtitle={`MP4, WebM or MOV · max ${limits.maxVideoMb || 200} MB per video`}>
        <form onSubmit={upload} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" required>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="input" placeholder="Last over thriller at Kirtipur" maxLength={140} required />
              </Field>
              <Field label="Type">
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="input">
                  {types.map((row) => <option key={row.key} value={row.key} className="bg-ink-900">{row.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Link to a match" hint="Optional — highlights and replays attach to the fixture">
              <select value={form.matchId} onChange={(event) => setForm({ ...form, matchId: event.target.value })} className="input">
                <option value="" className="bg-ink-900">No match</option>
                {matches.map((match) => (
                  <option key={match._id} value={match._id} className="bg-ink-900">
                    {match.teamA?.shortName} vs {match.teamB?.shortName} · {match.series}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description" hint="Shown under the title on the video hub">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} className="input resize-none" placeholder="What happens in this clip?" maxLength={1200} />
            </Field>

            <div>
              <span className="label">Video file</span>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-lime">
                  {file ? <Video size={18} /> : <UploadCloud size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/75">{file ? file.name : "No file selected"}</p>
                  <p className="truncate text-[10px] text-white/30">
                    {file ? `${formatBytes(file.size)} · ${duration ? formatSeconds(duration) : "reading duration…"}` : `Up to ${limits.maxVideoMb || 200} MB · stored on Cloudinary`}
                  </p>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-soft btn-xs" disabled={progress >= 0}>
                  {file ? "Replace" : "Browse"}
                </button>
                {file && progress < 0 && (
                  <button type="button" onClick={reset} className="btn-danger btn-xs">Clear</button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => pickFile(event.target.files?.[0])}
                />
              </div>
            </div>

            {progress >= 0 && (
              <div>
                <p className="mb-1 flex justify-between text-[10px] text-white/45"><span className="inline-flex items-center gap-1.5"><Loader2 size={11} className="animate-spin text-lime" /> Uploading to Cloudinary…</span><span className="font-mono text-lime">{progress}%</span></p>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-lime transition-all" style={{ width: `${progress}%` }} /></div>
                <p className="mt-1 text-[9px] text-white/25">Keep this tab open. A {limits.maxVideoMb || 200} MB file can take a couple of minutes.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <button type="submit" className="btn-primary" disabled={busy || !file}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {busy ? "Uploading…" : "Upload video"}
              </button>
              <span className="text-[10px] text-white/30">Photos are capped at {limits.maxImageMb || 50} MB · videos at {limits.maxVideoMb || 200} MB</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black">
            {previewUrl ? (
              <video src={previewUrl} controls className="aspect-video h-auto w-full object-contain" />
            ) : (
              <div className="grid aspect-video place-items-center p-5 text-center">
                <div>
                  <Play size={26} className="mx-auto mb-2 text-white/20" />
                  <p className="text-xs font-semibold text-white/45">Preview</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/25">Choose a video to preview it here before uploading.</p>
                </div>
              </div>
            )}
            <div className="border-t border-white/[0.06] bg-ink-950/60 px-3 py-2">
              <p className="truncate text-[11px] font-semibold text-white/65">{form.title || "Untitled video"}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">{form.type}{duration ? ` · ${formatSeconds(duration)}` : ""}{file ? ` · ${formatBytes(file.size)}` : ""}</p>
            </div>
          </div>
        </form>
      </Panel>

      <Panel bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            tabs={[
              { key: "all", label: `All (${totalVideos})` },
              ...types.map((row) => ({ key: row.key, label: `${row.label} (${summary[row.key] || 0})` })),
            ]}
            value={tab}
            onChange={setTab}
            size="sm"
          />
          <label className="relative lg:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos…" className="input !py-2 pl-9 text-xs" />
          </label>
        </div>

        {filtered.length ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((video) => (
              <div key={video._id} className="group overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition hover:border-lime/25">
                <div className="relative aspect-video overflow-hidden bg-ink-950">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center"><Clapperboard size={24} className="text-white/15" /></div>
                  )}
                  <span className={cn("absolute left-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider", typeStyle[video.type] || "bg-white/10 text-white/60")}>
                    {video.type}
                  </span>
                  {video.duration ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-white/70">{formatSeconds(video.duration)}</span>
                  ) : null}
                  <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white/85 backdrop-blur"><Play size={16} fill="currentColor" /></span>
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold text-white/85">{video.title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-white/30">{video.match?.series || video.description || "Bethub video"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-white/30">
                    <span className="inline-flex items-center gap-1"><Eye size={9} /> {formatNumber(video.views || 0)}</span>
                    <span className="inline-flex items-center gap-1"><Heart size={9} /> {formatNumber(video.likes || 0)}</span>
                    <span>{formatBytes(video.bytes || 0)}</span>
                    <span className="ml-auto">{formatDate(video.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2">
                    <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-lime hover:underline"><Play size={10} /> Play</a>
                    <button onClick={() => setConfirm(video)} className="rounded p-1 text-white/30 transition hover:bg-coral/10 hover:text-coral" title="Delete video">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Film size={20} />}
              title="No videos in this view"
              text="Upload a short, highlight or full replay above."
              action={<button onClick={() => fileRef.current?.click()} className="btn-primary btn-xs"><Plus size={12} /> Choose a video</button>}
            />
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (deleting ? null : setConfirm(null))}
        onConfirm={remove}
        title="Delete this video?"
        text={`"${confirm?.title || "This video"}" will be removed from Cloudinary and the Bethub library. This cannot be undone.`}
        confirmLabel="Delete video"
        danger
        loading={deleting}
      />
    </AdminPage>
  );
}
