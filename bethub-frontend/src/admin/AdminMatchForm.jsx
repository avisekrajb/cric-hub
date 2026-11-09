import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Info,
  Loader2,
  Save,
  Search,
  Shield,
  Shirt,
  Users,
} from "lucide-react";
import { AdminPage, Field, Panel, Toggle } from "./components/AdminUI";
import { PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import { cn, teamName } from "../lib/utils";

const FORMATS = [
  { value: "T10", overs: 10 },
  { value: "T20", overs: 20 },
  { value: "ODI", overs: 50 },
  { value: "Test", overs: 90 },
  { value: "Custom", overs: 20 },
];

const toLocalInput = (date) => {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const off = value.getTimezoneOffset();
  return new Date(value.getTime() - off * 60000).toISOString().slice(0, 16);
};

const playerIdOf = (row) => String(row?.player?._id || row?.player || "");

const defaultForm = () => ({
  title: "",
  series: "Bethub Series",
  format: "T20",
  overs: 20,
  venue: "",
  city: "",
  startTime: toLocalInput(new Date()),
  matchNumber: "",
  teamA: "",
  teamB: "",
  isFeatured: false,
  toss: { winnerSlot: "A", decision: "bat" },
  officials: { umpires: "", referee: "", scorer: "" },
  lineups: { A: [], B: [] },
});

function rowsFromTeam(team, existing = []) {
  if (!team) return [];
  const byId = new Map((team.players || []).map((player) => [String(player._id), player]));
  if (existing.length) {
    return existing
      .map((row, index) => ({
        player: playerIdOf(row),
        order: index,
        isCaptain: Boolean(row.isCaptain),
        isKeeper: Boolean(row.isKeeper),
      }))
      .filter((row) => byId.has(row.player));
  }
  return (team.players || []).slice(0, 11).map((player, index) => ({
    player: String(player._id),
    order: index,
    isCaptain: String(team.captain?._id || team.captain || "") === String(player._id),
    isKeeper: String(team.wicketkeeper?._id || team.wicketkeeper || "") === String(player._id),
  }));
}

function LineupEditor({ team, rows, onChange, locked }) {
  const [search, setSearch] = useState("");
  const [side, setSide] = useState("selected");

  const selectedIds = useMemo(() => new Set(rows.map(playerIdOf)), [rows]);
  const playerMap = useMemo(() => {
    const map = new Map((team?.players || []).map((player) => [String(player._id), player]));
    for (const row of rows) {
      if (row.player && typeof row.player === "object" && row.player._id) {
        map.set(String(row.player._id), row.player);
      }
    }
    return map;
  }, [team, rows]);

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (team?.players || []).filter((player) => {
      if (!term) return true;
      return `${player.name} ${player.role} ${player.country?.name || ""}`.toLowerCase().includes(term);
    });
  }, [team, search]);

  const add = (player) => {
    if (locked || rows.length >= 11 || selectedIds.has(String(player._id))) return;
    onChange([
      ...rows,
      {
        player: String(player._id),
        order: rows.length,
        isCaptain: String(team?.captain?._id || team?.captain || "") === String(player._id),
        isKeeper: String(team?.wicketkeeper?._id || team?.wicketkeeper || "") === String(player._id),
      },
    ]);
  };

  const remove = (id) => {
    if (locked) return;
    onChange(rows.filter((row) => playerIdOf(row) !== String(id)).map((row, index) => ({ ...row, order: index })));
  };

  const move = (index, direction) => {
    if (locked) return;
    const next = [...rows];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next.map((item, position) => ({ ...item, order: position })));
  };

  const flag = (id, key) => {
    if (locked) return;
    onChange(rows.map((row) => (playerIdOf(row) === String(id) ? { ...row, [key]: !row[key] } : row)));
  };

  if (!team) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center text-xs text-white/35">
        Pick a team first to build the batting order.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TeamLogo team={team} size="sm" />
          <div>
            <p className="text-xs font-semibold text-white/80">{teamName(team)} line-up</p>
            <p className="text-[10px] text-white/30">{rows.length}/11 selected · batting order</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {[
            { key: "selected", label: `Order (${rows.length})` },
            { key: "squad", label: `Squad (${team.players?.length || 0})` },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSide(option.key)}
              className={cn(
                "rounded px-2.5 py-1 text-[10px] font-semibold transition",
                side === option.key ? "bg-lime text-ink-950" : "text-white/45 hover:text-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {locked && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-[10px] text-amber-200/80">
          <Info size={12} className="mt-0.5 shrink-0" /> Line-ups are locked because this match has already started.
        </p>
      )}

      {side === "selected" ? (
        rows.length ? (
          <div className="space-y-1.5">
            {rows.map((row, index) => {
              const player = playerMap.get(playerIdOf(row));
              return (
                <div
                  key={`${playerIdOf(row)}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] font-mono text-[10px] font-bold text-white/50">
                    {index + 1}
                  </span>
                  <PlayerAvatar player={player} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-white/80">{player?.name || "Player"}</p>
                    <p className="truncate text-[9px] text-white/30">{player?.role || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => flag(playerIdOf(row), "isCaptain")}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded text-[9px] font-bold transition",
                      row.isCaptain ? "bg-lime/15 text-lime" : "bg-white/[0.04] text-white/25 hover:text-white"
                    )}
                    title="Captain"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => flag(playerIdOf(row), "isKeeper")}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded text-[9px] font-bold transition",
                      row.isKeeper ? "bg-sky/15 text-sky" : "bg-white/[0.04] text-white/25 hover:text-white"
                    )}
                    title="Wicket-keeper"
                  >
                    WK
                  </button>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || locked}
                      className="rounded p-0.5 text-white/30 hover:text-lime disabled:opacity-20"
                      title="Move up"
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1 || locked}
                      className="rounded p-0.5 text-white/30 hover:text-lime disabled:opacity-20"
                      title="Move down"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(playerIdOf(row))}
                    disabled={locked}
                    className="rounded p-1 text-white/25 transition hover:bg-coral/10 hover:text-coral disabled:opacity-20"
                    title="Remove from line-up"
                  >
                    <span className="text-xs">×</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[10px] text-white/30">
            No players selected. Add at least 2 from the squad.
          </p>
        )
      ) : (
        <div className="space-y-2">
          <label className="relative block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search squad…"
              className="input !py-1.5 pl-8 text-[11px]"
            />
          </label>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {available.map((player) => {
              const selected = selectedIds.has(String(player._id));
              return (
                <button
                  key={player._id}
                  type="button"
                  onClick={() => (selected ? remove(player._id) : add(player))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                    selected
                      ? "border-lime/25 bg-lime/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  )}
                >
                  <PlayerAvatar player={player} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-white/80">{player.name}</span>
                    <span className="block truncate text-[9px] text-white/30">{player.role}</span>
                  </span>
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded",
                      selected ? "bg-lime text-ink-950" : "bg-white/[0.05] text-white/30"
                    )}
                  >
                    <Check size={11} />
                  </span>
                </button>
              );
            })}
            {!available.length && <p className="py-5 text-center text-[10px] text-white/30">No players in this squad.</p>}
          </div>
          <p className="text-[9px] text-white/25">Players are registered once in the Players desk, then reused here and in every team.</p>
        </div>
      )}
    </div>
  );
}

export default function AdminMatchForm({ embedded = false, matchId = null, onDone = null }) {
  const params = useParams();
  const id = matchId || params.id;
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { data: teamsData, loading: teamsLoading } = useFetch("/api/teams?active=all");
  const { data: matchData, loading: matchLoading } = useFetch(editing ? `/api/matches/${id}` : null, { deps: [id] });
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState("upcoming");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  const teams = teamsData?.teams || [];
  const match = matchData?.match;
  const teamA = teams.find((team) => String(team._id) === String(form.teamA));
  const teamB = teams.find((team) => String(team._id) === String(form.teamB));
  const lineupsLocked = editing && ["live", "innings-break", "finished"].includes(status);

  useEffect(() => {
    if (!editing || !match || !teamsData || initialized.current) return;
    initialized.current = true;
    setStatus(match.status);
    setForm({
      title: match.title || "",
      series: match.series || "Bethub Series",
      format: match.format || "T20",
      overs: match.overs || 20,
      venue: match.venue || "",
      city: match.city || "",
      startTime: toLocalInput(match.startTime),
      matchNumber: match.matchNumber || "",
      teamA: String(match.teamA?._id || match.teamA || ""),
      teamB: String(match.teamB?._id || match.teamB || ""),
      isFeatured: Boolean(match.isFeatured),
      toss: {
        winnerSlot: match.toss?.winnerSlot || "A",
        decision: match.toss?.decision || "bat",
      },
      officials: {
        umpires: match.officials?.umpires || "",
        referee: match.officials?.referee || "",
        scorer: match.officials?.scorer || "",
      },
      lineups: {
        A: rowsFromTeam(teams.find((team) => String(team._id) === String(match.teamA?._id || match.teamA)), match.lineups?.A || []),
        B: rowsFromTeam(teams.find((team) => String(team._id) === String(match.teamB?._id || match.teamB)), match.lineups?.B || []),
      },
    });
  }, [editing, match, teams]);

  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const chooseTeam = (slot, teamId) => {
    const team = teams.find((row) => String(row._id) === String(teamId));
    setForm((current) => ({
      ...current,
      [slot === "A" ? "teamA" : "teamB"]: teamId,
      lineups: {
        ...current.lineups,
        [slot]: rowsFromTeam(team),
      },
      toss: current.toss,
    }));
  };

  const setFormat = (format) => {
    const preset = FORMATS.find((row) => row.value === format);
    setForm((current) => ({
      ...current,
      format,
      overs: preset ? preset.overs : current.overs,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.teamA || !form.teamB) return setError("Choose both teams");
    if (String(form.teamA) === String(form.teamB)) return setError("A team cannot play itself");
    if (!form.startTime) return setError("Choose a start date and time");
    if (form.lineups.A.length < 2 || form.lineups.B.length < 2) {
      return setError("Each team needs at least 2 players in the line-up");
    }

    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        series: form.series.trim() || "Bethub Series",
        format: form.format,
        overs: Number(form.overs) || 20,
        venue: form.venue.trim(),
        city: form.city.trim(),
        startTime: new Date(form.startTime).toISOString(),
        matchNumber: form.matchNumber ? Number(form.matchNumber) : undefined,
        teamA: form.teamA,
        teamB: form.teamB,
        isFeatured: form.isFeatured,
        toss: form.toss,
        officials: form.officials,
      };
      if (!lineupsLocked) {
        payload.lineups = {
          A: form.lineups.A.map((row, index) => ({
            player: playerIdOf(row),
            order: index,
            isCaptain: Boolean(row.isCaptain),
            isKeeper: Boolean(row.isKeeper),
          })),
          B: form.lineups.B.map((row, index) => ({
            player: playerIdOf(row),
            order: index,
            isCaptain: Boolean(row.isCaptain),
            isKeeper: Boolean(row.isKeeper),
          })),
        };
      }

      if (editing) {
        const result = await api(`/api/matches/${id}`, { method: "PATCH", body: payload });
        success("Match updated — changes are live everywhere");
        if (embedded) onDone?.({ match: { _id: id }, ...result });
        else navigate("/admin/matches");
      } else {
        const result = await api("/api/matches", { method: "POST", body: payload });
        success("Match created — start it when you're ready");
        if (embedded) onDone?.(result);
        else navigate(`/admin/matches/${result.match?._id || ""}/score`);
      }
    } catch (err) {
      setError(err.message || "Could not save the match");
      toastError(err.message || "Could not save the match");
    } finally {
      setBusy(false);
    }
  };

  if (editing && matchLoading && !match) {
    return embedded ? <div className="p-8"><PageLoader label="Loading the fixture…" /></div> : <PageLoader label="Loading the fixture…" />;
  }
  if (!editing && teamsLoading && !teamsData) {
    return embedded ? <div className="p-8"><PageLoader label="Loading teams…" /></div> : <PageLoader label="Loading teams…" />;
  }

  const formBody = (
    <form onSubmit={submit} className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Fixture details" subtitle="What the public sees">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Match title" hint="Leave blank to auto-name it from the teams" className="sm:col-span-2">
                <input value={form.title} onChange={(event) => patch("title", event.target.value)} placeholder="e.g. Nepal vs India · 2nd T20I" className="input" />
              </Field>
              <Field label="Series" required>
                <input value={form.series} onChange={(event) => patch("series", event.target.value)} placeholder="Bethub Series" className="input" required />
              </Field>
              <Field label="Match number">
                <input type="number" min="1" value={form.matchNumber} onChange={(event) => patch("matchNumber", event.target.value)} placeholder="Auto" className="input" />
              </Field>
              <Field label="Format" required>
                <select value={form.format} onChange={(event) => setFormat(event.target.value)} className="input">
                  {FORMATS.map((row) => (
                    <option key={row.value} value={row.value} className="bg-ink-900">
                      {row.value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Overs" required>
                <input type="number" min="1" max="450" value={form.overs} onChange={(event) => patch("overs", event.target.value)} className="input" required />
              </Field>
              <Field label="Venue">
                <input value={form.venue} onChange={(event) => patch("venue", event.target.value)} placeholder="Tribhuvan University Ground" className="input" />
              </Field>
              <Field label="City">
                <input value={form.city} onChange={(event) => patch("city", event.target.value)} placeholder="Kirtipur" className="input" />
              </Field>
              <Field label="Start date & time" required className="sm:col-span-2">
                <input type="datetime-local" value={form.startTime} onChange={(event) => patch("startTime", event.target.value)} className="input" required />
              </Field>
            </div>
            <div className="mt-3">
              <Toggle
                checked={form.isFeatured}
                onChange={(value) => patch("isFeatured", value)}
                label="Feature on the home page"
                hint="Pins this fixture to the hero slot when it is live."
              />
            </div>
          </Panel>

          <Panel
            title="Playing XIs"
            subtitle="Select from the registered squad, then order the batting line-up"
            action={<span className="chip !text-[10px]"><Shirt size={10} /> Reuse players, no re-entry</span>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { slot: "A", team: teamA, rows: form.lineups.A },
                { slot: "B", team: teamB, rows: form.lineups.B },
              ].map(({ slot, team, rows }) => (
                <div key={slot} className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                  <Field label={`Team ${slot}`} required>
                    <select
                      value={form[slot === "A" ? "teamA" : "teamB"]}
                      onChange={(event) => chooseTeam(slot, event.target.value)}
                      className="input"
                      required
                    >
                      <option value="" className="bg-ink-900">Choose team {slot}</option>
                      {teams.map((row) => (
                        <option key={row._id} value={row._id} className="bg-ink-900" disabled={String(row._id) === String(slot === "A" ? form.teamB : form.teamA)}>
                          {row.name} ({row.shortName})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <LineupEditor
                    slot={slot}
                    team={team}
                    rows={rows}
                    locked={lineupsLocked}
                    onChange={(next) => patch("lineups", { ...form.lineups, [slot]: next })}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Toss & officials" subtitle="Set before the first ball">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Toss winner">
                <select value={form.toss.winnerSlot} onChange={(event) => patch("toss", { ...form.toss, winnerSlot: event.target.value })} className="input">
                  <option value="A" className="bg-ink-900">{teamName(teamA)} (Team A)</option>
                  <option value="B" className="bg-ink-900">{teamName(teamB)} (Team B)</option>
                </select>
              </Field>
              <Field label="Elected to">
                <select value={form.toss.decision} onChange={(event) => patch("toss", { ...form.toss, decision: event.target.value })} className="input">
                  <option value="bat" className="bg-ink-900">Bat first</option>
                  <option value="bowl" className="bg-ink-900">Bowl first</option>
                </select>
              </Field>
              <Field label="Umpires">
                <input value={form.officials.umpires} onChange={(event) => patch("officials", { ...form.officials, umpires: event.target.value })} placeholder="Two umpires" className="input" />
              </Field>
              <Field label="Match referee">
                <input value={form.officials.referee} onChange={(event) => patch("officials", { ...form.officials, referee: event.target.value })} placeholder="Referee name" className="input" />
              </Field>
              <Field label="Scorer" className="sm:col-span-2">
                <input value={form.officials.scorer} onChange={(event) => patch("officials", { ...form.officials, scorer: event.target.value })} placeholder="Scorer name" className="input" />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Fixture summary" subtitle="A last look before you save">
            <div className="space-y-3">
              {[
                { slot: "A", team: teamA, rows: form.lineups.A },
                { slot: "B", team: teamB, rows: form.lineups.B },
              ].map(({ slot, team, rows }) => (
                <div key={slot} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <TeamLogo team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/80">{team ? team.name : `Team ${slot} not chosen`}</p>
                    <p className="text-[10px] text-white/30">
                      {rows.length} players · {rows.filter((row) => row.isCaptain).length ? "captain set" : "captain TBC"} ·{" "}
                      {rows.filter((row) => row.isKeeper).length ? "keeper set" : "keeper TBC"}
                    </p>
                  </div>
                  {team && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-white/45">{team.shortName}</span>}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Format</p>
                  <p className="mt-0.5 font-semibold text-white/75">{form.format} · {form.overs} ov</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Start</p>
                  <p className="mt-0.5 truncate font-semibold text-white/75">{form.startTime ? new Date(form.startTime).toLocaleString() : "Not set"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Toss</p>
                  <p className="mt-0.5 font-semibold text-white/75">{teamName(form.toss.winnerSlot === "A" ? teamA : teamB)} {form.toss.decision}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Series</p>
                  <p className="mt-0.5 truncate font-semibold text-white/75">{form.series || "—"}</p>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 rounded-lg border border-coral/20 bg-coral/10 px-3 py-2 text-[11px] text-coral">{error}</p>}

            <button type="submit" className="btn-primary mt-4 w-full" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {busy ? "Saving…" : editing ? "Save changes" : "Create match"}
            </button>
            {lineupsLocked && (
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-white/30">
                <Info size={11} className="mt-0.5 shrink-0" /> This match has started, so line-up changes are locked. Other details can still be updated.
              </p>
            )}
          </Panel>

          {!editing && (
            <div className="rounded-2xl border border-sky/15 bg-sky/[0.05] p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky"><Users size={12} /> What happens next</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                Saving creates the fixture as upcoming. Open the scorer's console, start the match, then go live from the broadcast desk.
              </p>
              <Link to="/admin/players" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sky hover:underline">
                <Shield size={10} /> Need more players? Register them once here →
              </Link>
            </div>
          )}
        </div>
      </form>
  );

  if (embedded) {
    return <div className="animate-fade-up px-0.5 pb-1">{formBody}</div>;
  }

  return (
    <AdminPage
      eyebrow={editing ? "Edit fixture" : "New fixture"}
      title={editing ? `${teamName(teamA)} vs ${teamName(teamB)}` : "Create a match"}
      subtitle="Teams, squads, toss and venue — one form, then straight to the scorer's console."
      actions={
        <Link to="/admin/matches" className="btn-ghost btn-xs">
          <ArrowLeft size={13} /> Back to matches
        </Link>
      }
    >
      {formBody}
    </AdminPage>
  );
}
