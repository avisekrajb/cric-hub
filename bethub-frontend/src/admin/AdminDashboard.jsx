import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clapperboard,
  Film,
  Flag,
  Play,
  Plus,
  Radio,
  Shield,
  Sparkles,
  Tv,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { AdminPage, Panel, StatCard, StatusDot } from "./components/AdminUI";
import { TeamLogo } from "../components/common/Avatars";
import { PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { cn, formatNumber, resultText, scoreSummary, timeAgo } from "../lib/utils";

function LiveRow({ match }) {
  const score = scoreSummary(match);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
      <div className="flex shrink-0 -space-x-1.5">
        <TeamLogo team={match.teamA} size="sm" />
        <TeamLogo team={match.teamB} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white/85">{match.teamA?.shortName} vs {match.teamB?.shortName}</p>
        <p className="truncate text-[10px] text-white/35">{match.series} · {match.status === "live" ? `${match.innings?.[match.currentInnings]?.overs || "0.0"} overs` : "innings break"}</p>
      </div>
      <p className="font-mono text-xs font-bold text-white/80">{score.a || "—"} <span className="text-white/20">·</span> {score.b || "—"}</p>
      <div className="flex shrink-0 gap-1.5">
        <Link to={`/admin/matches/${match._id}/score`} className="btn-primary btn-xs">Score</Link>
        <Link to={`/admin/streams?match=${match._id}`} className={cn("btn-ghost btn-xs", match.stream?.isLive && "!border-coral/30 !text-coral")}>
          <Tv size={11} /> {match.stream?.isLive ? "On air" : "Stream"}
        </Link>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, loading, refetch, setData } = useFetch("/api/stats/overview", { poll: 30000 });
  const { data: recordings, refetch: refetchRecordings } = useFetch("/api/streams/recording-status", { poll: 20000 });
  const { data: media } = useFetch("/api/media/summary", { poll: 60000 });
  const timer = useRef(null);

  const schedule = () => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      refetch(true);
      refetchRecordings(true);
    }, 1500);
  };

  useSocketEvent("score:update", ({ match }) => {
    if (!match) return;
    setData((current) => {
      if (!current) return current;
      const live = current.live || [];
      const exists = live.some((row) => row._id === match._id);
      const nextLive = ["live", "innings-break"].includes(match.status)
        ? exists
          ? live.map((row) => (row._id === match._id ? match : row))
          : [...live, match]
        : live.filter((row) => row._id !== match._id);
      return { ...current, live: nextLive };
    });
    schedule();
  });
  useSocketEvent("notification", schedule);
  useSocketEvent("stream:update", schedule);

  if (loading && !data) return <PageLoader label="Loading the control room…" />;

  const counts = data?.counts || {};
  const live = data?.live || [];
  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];
  const limits = recordings?.limits || {};

  return (
    <AdminPage
      eyebrow="Control room"
      title="Matchday dashboard"
      subtitle="A live snapshot of every match, stream, player and upload on Bethub."
      actions={
        <>
          <Link to="/admin/streams" className="btn-ghost btn-xs"><Tv size={13} /> Streams</Link>
          <Link to="/admin/matches/new" className="btn-primary btn-xs"><Plus size={13} /> New match</Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Radio} label="Live matches" value={formatNumber(counts.live || 0)} hint={`${limits.maxLiveMatches || 10} max at once`} accent="text-coral" />
        <StatCard icon={Tv} label="Live streams" value={formatNumber(counts.liveStreams || 0)} hint={`${formatNumber(counts.viewers || 0)} watching`} accent="text-lime" />
        <StatCard icon={Shield} label="Matches" value={formatNumber(counts.matches || 0)} hint="all competitions" accent="text-mint" />
        <StatCard icon={Users} label="Teams" value={formatNumber(counts.teams || 0)} hint={`${formatNumber(counts.players || 0)} players`} accent="text-sky" />
        <StatCard icon={Flag} label="Countries" value={formatNumber(counts.countries || 0)} hint="flags & codes" accent="text-white/70" />
        <StatCard icon={Video} label="Videos" value={formatNumber(counts.videos || 0)} hint={`${formatNumber(media?.views || 0)} views`} accent="text-white/70" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Live on Bethub"
          subtitle="Jump straight into scoring or the broadcast desk"
          action={<Link to="/live" className="text-[10px] font-semibold text-lime hover:underline">Public score centre →</Link>}
          bodyClassName="!p-0"
        >
          {live.length ? live.map((match) => <LiveRow key={match._id} match={match} />) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Radio size={22} className="text-white/15" />
              <p className="text-xs text-white/40">No match is live right now.</p>
              <Link to="/admin/matches" className="btn-primary btn-xs mt-1"><Play size={12} /> Start a match</Link>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Stream limits" subtitle="Enforced live by the server" bodyClassName="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[10px]"><span className="text-white/40">Live matches</span><span className="font-mono text-white/65">{recordings?.live || 0} / {limits.maxLiveMatches || 10}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-lime" style={{ width: `${Math.min(100, ((recordings?.live || 0) / (limits.maxLiveMatches || 10)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px]"><span className="text-white/40">Concurrent recordings</span><span className="font-mono text-white/65">{recordings?.recording || 0} / {limits.maxRecordings || 5}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, ((recordings?.recording || 0) / (limits.maxRecordings || 5)) * 100)}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-2 text-[10px] text-white/35">
              <StatusDot active={recordings?.live > 0} label="Broadcast engine" />
              <span>{formatNumber(recordings?.viewers || 0)} viewers</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
              <Link to="/admin/streams" className="rounded-lg bg-white/[0.03] px-2 py-2 text-center text-[10px] font-semibold text-white/55 hover:bg-white/[0.07] hover:text-lime"><Tv size={13} className="mx-auto mb-1" /> Go live</Link>
              <Link to="/admin/media" className="rounded-lg bg-white/[0.03] px-2 py-2 text-center text-[10px] font-semibold text-white/55 hover:bg-white/[0.07] hover:text-lime"><Film size={13} className="mx-auto mb-1" /> Upload</Link>
              <Link to="/admin/players" className="rounded-lg bg-white/[0.03] px-2 py-2 text-center text-[10px] font-semibold text-white/55 hover:bg-white/[0.07] hover:text-lime"><UserRound size={13} className="mx-auto mb-1" /> Player</Link>
            </div>
          </Panel>

          <Panel title="Media library" subtitle="Uploads stored on Cloudinary" action={<Link to="/admin/media" className="text-[10px] font-semibold text-lime hover:underline">Open →</Link>}>
            <div className="grid grid-cols-2 gap-2">
              {["short", "highlight", "long", "replay"].map((type) => (
                <div key={type} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">{type}</p>
                  <p className="font-mono text-base font-bold text-white/80">{media?.summary?.[type] || 0}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-2 text-[10px] text-white/30"><Clapperboard size={11} /> {formatNumber(media?.views || 0)} total views · {formatNumber(media?.bytes || 0)} bytes stored</p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Coming up" subtitle="Scheduled fixtures" action={<Link to="/admin/matches" className="text-[10px] font-semibold text-lime hover:underline">All →</Link>} bodyClassName="!p-0">
          {upcoming.length ? upcoming.slice(0, 5).map((match) => (
            <div key={match._id} className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
              <CalendarDays size={13} className="shrink-0 text-sky/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/80">{match.teamA?.shortName} vs {match.teamB?.shortName}</p>
                <p className="text-[9px] text-white/35">{timeAgo(match.startTime)} · {match.venue || match.series}</p>
              </div>
              <Link to={`/admin/matches/${match._id}/edit`} className="rounded p-1 text-white/30 hover:bg-white/10 hover:text-lime"><ArrowUpRight size={12} /></Link>
            </div>
          )) : <p className="px-4 py-8 text-center text-xs text-white/35">No upcoming matches.</p>}
        </Panel>

        <Panel title="Recent results" subtitle="Last finished matches" action={<Link to="/admin/matches" className="text-[10px] font-semibold text-lime hover:underline">All →</Link>} bodyClassName="!p-0">
          {recent.length ? recent.slice(0, 5).map((match) => (
            <div key={match._id} className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
              <div className="flex shrink-0 -space-x-1.5"><TeamLogo team={match.teamA} size="xs" /><TeamLogo team={match.teamB} size="xs" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/80">{match.teamA?.shortName} vs {match.teamB?.shortName}</p>
                <p className="truncate text-[9px] text-lime/70">{resultText(match)}</p>
              </div>
              <span className="text-[9px] text-white/25">{timeAgo(match.startTime)}</span>
            </div>
          )) : <p className="px-4 py-8 text-center text-xs text-white/35">No completed matches.</p>}
        </Panel>

        <Panel title="Quick actions" subtitle="The everyday jobs" bodyClassName="space-y-2">
          {[
            { to: "/admin/matches/new", icon: Plus, label: "Create a new match", text: "Teams, squads, toss and fixtures" },
            { to: "/admin/streams", icon: Tv, label: "Go live with video", text: "Camera, HLS or embed + recording" },
            { to: "/admin/players", icon: UserRound, label: "Register a player", text: "Once, then reuse in every team" },
            { to: "/admin/countries", icon: Flag, label: "Upload a country flag", text: "Shows everywhere automatically" },
            { to: "/admin/media", icon: Clapperboard, label: "Upload a video", text: "Shorts and long form, straight to Cloudinary" },
          ].map((row) => (
            <Link key={row.to} to={row.to} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-lime/25 hover:bg-lime/[0.04]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-lime"><row.icon size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-white/80">{row.label}</span>
                <span className="block text-[10px] text-white/30">{row.text}</span>
              </span>
              <ArrowRight size={13} className="text-white/20" />
            </Link>
          ))}
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime/15 bg-gradient-to-r from-lime/[0.07] to-transparent px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-white/55"><Sparkles size={14} className="text-lime" /> Everything you change here broadcasts instantly to every viewer.</p>
        <Link to="/admin/settings" className="text-[10px] font-semibold text-lime hover:underline">Profile &amp; settings →</Link>
      </div>
    </AdminPage>
  );
}
