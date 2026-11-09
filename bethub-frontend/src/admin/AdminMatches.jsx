import { Fragment, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  Star,
  Trash2,
  Tv,
  Users,
} from "lucide-react";
import { AdminPage, Panel, StatCard } from "./components/AdminUI";
import AdminMatchForm from "./AdminMatchForm";
import ConfirmDialog from "../components/common/ConfirmDialog";
import Modal from "../components/common/Modal";
import Tabs from "../components/common/Tabs";
import { StatusPill } from "../components/common/Badges";
import { TeamLogo } from "../components/common/Avatars";
import { EmptyState, PageLoader } from "../components/common/States";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { cn, formatDateTime, formatNumber, matchViews, resultText, scoreSummary, sortMatches, timeAgo } from "../lib/utils";

const tabs = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

const isLiveStatus = (match) => ["live", "innings-break"].includes(match?.status);

export default function AdminMatches() {
  const { data, loading, refetch, setData } = useFetch("/api/matches?limit=150", { poll: 30000 });
  const { data: recordings } = useFetch("/api/streams/recording-status", { poll: 20000 });
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  useSocketEvent("score:update", ({ match }) => {
    if (!match) return;
    setData((current) => {
      if (!current?.matches) return current;
      const exists = current.matches.some((row) => row._id === match._id);
      return {
        ...current,
        matches: exists
          ? current.matches.map((row) => (row._id === match._id ? match : row))
          : [match, ...current.matches],
      };
    });
  });

  useSocketEvent("stream:update", () => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refetch(true);
    }, 1200);
  });

  const matches = data?.matches || [];
  const counts = useMemo(
    () => ({
      total: matches.length,
      live: matches.filter((row) => isLiveStatus(row)).length,
      upcoming: matches.filter((row) => row.status === "upcoming").length,
      finished: matches.filter((row) => row.status === "finished").length,
      streams: matches.filter((row) => row.stream?.isLive).length,
      views: matches.reduce((sum, row) => sum + matchViews(row), 0),
    }),
    [matches]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = matches.filter((match) => {
      if (tab === "live" && !isLiveStatus(match)) return false;
      if (tab === "upcoming" && match.status !== "upcoming") return false;
      if (tab === "finished" && match.status !== "finished") return false;
      if (!term) return true;
      return `${match.teamA?.name} ${match.teamB?.name} ${match.teamA?.shortName} ${match.teamB?.shortName} ${match.series} ${match.venue} ${match.city}`
        .toLowerCase()
        .includes(term);
    });
    return sortMatches(rows);
  }, [matches, tab, search]);

  const groups = useMemo(() => {
    const buckets = [
      { key: "live", label: "Live now", rows: filtered.filter((match) => isLiveStatus(match)) },
      { key: "upcoming", label: "Upcoming", rows: filtered.filter((match) => match.status === "upcoming") },
      { key: "finished", label: "Finished", rows: filtered.filter((match) => match.status === "finished") },
      {
        key: "other",
        label: "Other",
        rows: filtered.filter((match) => !isLiveStatus(match) && !["upcoming", "finished"].includes(match.status)),
      },
    ];
    return buckets.filter((bucket) => bucket.rows.length);
  }, [filtered]);

  const ask = (action, match) => setConfirm({ action, match });

  const runAction = async () => {
    if (!confirm) return;
    const { action, match } = confirm;
    setBusy(true);
    try {
      if (action === "start") {
        await api(`/api/matches/${match._id}/start`, { method: "POST" });
        success(`${match.teamA?.shortName} vs ${match.teamB?.shortName} is live`);
      } else if (action === "finish") {
        await api(`/api/matches/${match._id}/finish`, { method: "POST", body: {} });
        success("Match finished and result published");
      } else if (action === "delete") {
        await api(`/api/matches/${match._id}`, { method: "DELETE" });
        success("Match deleted");
      } else if (action === "reset") {
        await api(`/api/matches/${match._id}/reset`, { method: "POST", body: { confirm: true } });
        success("Scorecard reset — the match is back to upcoming");
      } else if (action === "feature") {
        await api(`/api/matches/${match._id}/feature`, {
          method: "POST",
          body: { isFeatured: !match.isFeatured },
        });
        success(match.isFeatured ? "Removed from the featured slot" : "Pinned as the featured match");
      }
      setConfirm(null);
      await refetch(true);
    } catch (err) {
      toastError(err.message || "That action could not be completed");
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = {
    start: {
      title: "Start this match?",
      text: "The toss must already be set. Starting locks the line-ups and opens ball-by-ball scoring.",
      label: "Start match",
      danger: false,
    },
    finish: {
      title: "Finish the match?",
      text: "This closes both innings, calculates the result, picks a player of the match and ends the live stream.",
      label: "Finish match",
      danger: true,
    },
    delete: {
      title: "Delete this match?",
      text: "Every ball, scorecard entry and stream link for this fixture will be permanently removed.",
      label: "Delete match",
      danger: true,
    },
    reset: {
      title: "Reset the scorecard?",
      text: "All innings and deliveries are erased and the match returns to upcoming. This cannot be undone.",
      label: "Reset match",
      danger: true,
    },
  }[confirm?.action] || {};

  if (loading && !data) return <PageLoader label="Loading the fixture list…" />;

  const renderRow = (match) => {
    const scores = scoreSummary(match);
    const live = isLiveStatus(match);
    return (
      <tr key={match._id} className="group">
        <td>
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 -space-x-1.5">
              <TeamLogo team={match.teamA} size="sm" />
              <TeamLogo team={match.teamB} size="sm" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-white/85">
                {match.teamA?.shortName} vs {match.teamB?.shortName}
                {match.isFeatured && <Star size={10} className="fill-lime text-lime" />}
                {match.stream?.isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-coral">
                    <Radio size={8} /> video
                  </span>
                )}
              </p>
              <p className="max-w-[220px] truncate text-[10px] text-white/30">
                {match.format} · {match.overs} overs · {match.venue || "Venue TBC"}
              </p>
            </div>
          </div>
        </td>
        <td>
          <StatusPill status={match.status} />
          {match.status === "finished" && (
            <p className="mt-1 max-w-[170px] truncate text-[9px] text-lime/70">{resultText(match)}</p>
          )}
        </td>
        <td className="!text-right">
          <p className="font-mono text-[11px] font-semibold text-white/75">{scores.a || "—"}</p>
          <p className="font-mono text-[11px] text-white/50">{scores.b || "—"}</p>
        </td>
        <td>
          <p className="max-w-[140px] truncate text-[11px] text-white/60">{match.series}</p>
          <p className="text-[9px] text-white/25">Match {match.matchNumber}</p>
        </td>
        <td>
          <p className="text-[11px] text-white/55">{formatDateTime(match.startTime)}</p>
          <p className="text-[9px] text-white/25">{timeAgo(match.startTime)}</p>
        </td>
        <td className="!text-right">
          <p className="inline-flex items-center gap-1 font-mono text-[11px] text-white/55">
            <Eye size={10} className="text-white/30" /> {formatNumber(matchViews(match))}
          </p>
          {match.stream?.viewers > 0 && (
            <p className="text-[9px] text-coral/70">{formatNumber(match.stream.viewers)} now</p>
          )}
        </td>
        <td>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {match.status === "upcoming" && (
              <button
                onClick={() => ask("start", match)}
                className="rounded-lg border border-lime/25 bg-lime/10 p-1.5 text-lime transition hover:bg-lime/20"
                title="Start match"
              >
                <Play size={12} />
              </button>
            )}
            <Link
              to={`/admin/matches/${match._id}/score`}
              className={cn(
                "rounded-lg border p-1.5 transition",
                live
                  ? "border-lime/25 bg-lime/10 text-lime hover:bg-lime/20"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
              )}
              title="Scoring console"
            >
              <Radio size={12} />
            </Link>
            <Link
              to={`/admin/streams?match=${match._id}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 transition hover:border-coral/30 hover:text-coral"
              title="Broadcast desk"
            >
              <Tv size={12} />
            </Link>
            <Link
              to={`/admin/matches/${match._id}/edit`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 transition hover:border-sky/30 hover:text-sky"
              title="Edit match"
            >
              <Pencil size={12} />
            </Link>
            {match.status === "finished" && (
              <button
                onClick={() => ask("reset", match)}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/45 transition hover:border-coral/30 hover:text-coral"
                title="Reset scorecard"
              >
                <CheckCircle2 size={12} />
              </button>
            )}
            <button
              onClick={() => ask("finish", match)}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 transition hover:border-mint/30 hover:text-mint"
              title="Finish match"
              disabled={!live}
            >
              <CheckCircle2 size={12} />
            </button>
            <button
              onClick={() => ask("feature", match)}
              className={cn(
                "rounded-lg border p-1.5 transition",
                match.isFeatured
                  ? "border-lime/30 bg-lime/10 text-lime"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-lime"
              )}
              title={match.isFeatured ? "Unfeature" : "Feature on home"}
            >
              <Star size={12} className={match.isFeatured ? "fill-lime" : ""} />
            </button>
            <button
              onClick={() => ask("delete", match)}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/40 transition hover:border-coral/30 hover:text-coral"
              title="Delete match"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <AdminPage
      eyebrow="Match control"
      title="Matches"
      subtitle="Create fixtures, open the scorer's console, start broadcasts and publish results."
      actions={
        <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-xs">
          <Plus size={13} /> New match
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Radio} label="Live" value={counts.live} hint={`${recordings?.live || 0} streams on air`} accent="text-coral" />
        <StatCard icon={CalendarDays} label="Upcoming" value={counts.upcoming} hint="waiting for the toss" accent="text-sky" />
        <StatCard icon={CheckCircle2} label="Finished" value={counts.finished} hint="results published" accent="text-mint" />
        <StatCard icon={Eye} label="Total views" value={formatNumber(counts.views)} hint={`${counts.total} fixtures`} accent="text-lime" />
      </div>

      <Panel bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
          <label className="relative lg:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Team, series or venue…"
              className="input !py-2 pl-9 text-xs"
            />
          </label>
        </div>

        {groups.length ? (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[980px]">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Status</th>
                  <th className="!text-right">Score</th>
                  <th>Series</th>
                  <th>Starts</th>
                  <th className="!text-right">Views</th>
                  <th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="bg-white/[0.025]">
                      <td colSpan={7} className="!py-2">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                          {group.key === "live" && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" />}
                          {group.label}
                          <span className="text-white/20">· {group.rows.length}</span>
                        </span>
                      </td>
                    </tr>
                    {group.rows.map(renderRow)}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Users size={20} />}
              title="No matches match this filter"
              text="Create a fixture or clear the search to see every match."
              action={
                <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-xs">
                  <Plus size={12} /> New match
                </button>
              }
            />
          </div>
        )}
      </Panel>

      <Modal
        open={creating}
        onClose={() => (busy ? null : setCreating(false))}
        title="New fixture"
        subtitle="Teams, squads, toss and venue — create it without leaving the match list."
        size="xl"
      >
        <AdminMatchForm
          embedded
          onDone={() => {
            setCreating(false);
            refetch(true);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={runAction}
        title={confirmCopy.title}
        text={confirmCopy.text}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        loading={busy}
      />
    </AdminPage>
  );
}
