import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Crown,
  Pencil,
  Plus,
  Search,
  Shield,
  Shirt,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, Toggle } from "./components/AdminUI";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import UploadField from "../components/common/UploadField";
import Tabs from "../components/common/Tabs";
import { CountryFlag, PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import { cn, formatNumber } from "../lib/utils";

const emptyForm = () => ({
  name: "",
  shortName: "",
  country: "",
  logo: { url: "", publicId: "" },
  color: "#00e28a",
  coach: "",
  homeGround: "",
  players: [],
  captain: "",
  wicketkeeper: "",
  isActive: true,
});

const idOf = (row) => String(row?._id || row || "");

export default function AdminTeams() {
  const { data, loading, refetch } = useFetch("/api/teams?active=all", { poll: 60000 });
  const { data: countryData, refetch: refetchCountries } = useFetch("/api/countries?active=all");
  const { data: playerData, refetch: refetchPlayers } = useFetch("/api/players?limit=200&active=all");
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [tab, setTab] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [playerSearch, setPlayerSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const teams = data?.teams || [];
  const countries = countryData?.countries || [];
  const players = playerData?.players || [];

  const counts = useMemo(
    () => ({
      total: teams.length,
      active: teams.filter((team) => team.isActive).length,
      archived: teams.filter((team) => !team.isActive).length,
      players: teams.reduce((sum, team) => sum + (team.players?.length || 0), 0),
    }),
    [teams]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (tab === "active" && !team.isActive) return false;
      if (tab === "archived" && team.isActive) return false;
      if (country !== "all" && idOf(team.country) !== country) return false;
      if (!term) return true;
      return `${team.name} ${team.shortName} ${team.country?.name} ${team.coach} ${team.homeGround}`.toLowerCase().includes(term);
    });
  }, [teams, search, country, tab]);

  const squad = useMemo(() => {
    const selected = new Set(form.players.map(String));
    const term = playerSearch.trim().toLowerCase();
    return players
      .filter((player) => {
        if (!term) return true;
        return `${player.name} ${player.role} ${player.country?.name || ""}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const aSel = selected.has(String(a._id)) ? 0 : 1;
        const bSel = selected.has(String(b._id)) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        const aHome = form.country && idOf(a.country) === form.country ? 0 : 1;
        const bHome = form.country && idOf(b.country) === form.country ? 0 : 1;
        if (aHome !== bHome) return aHome - bHome;
        return a.name.localeCompare(b.name);
      });
  }, [players, playerSearch, form.players, form.country]);

  const selectedPlayers = useMemo(
    () => form.players.map((id) => players.find((player) => String(player._id) === String(id))).filter(Boolean),
    [form.players, players]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), country: countries[0]?._id || "" });
    setPlayerSearch("");
    setFormOpen(true);
  };

  const openEdit = (team) => {
    setEditing(team);
    setForm({
      name: team.name || "",
      shortName: team.shortName || "",
      country: idOf(team.country),
      logo: team.logo?.url ? { url: team.logo.url, publicId: team.logo.publicId || "" } : { url: "", publicId: "" },
      color: team.color || "#00e28a",
      coach: team.coach || "",
      homeGround: team.homeGround || "",
      players: (team.players || []).map(idOf),
      captain: idOf(team.captain),
      wicketkeeper: idOf(team.wicketkeeper),
      isActive: team.isActive !== false,
    });
    setPlayerSearch("");
    setFormOpen(true);
  };

  const togglePlayer = (player) => {
    const id = String(player._id);
    setForm((current) => {
      const active = current.players.map(String).includes(id);
      const nextPlayers = active ? current.players.filter((row) => String(row) !== id) : [...current.players, id];
      return {
        ...current,
        players: nextPlayers,
        captain: active && current.captain === id ? "" : current.captain,
        wicketkeeper: active && current.wicketkeeper === id ? "" : current.wicketkeeper,
      };
    });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.shortName.trim() || !form.country) {
      toastError("Team name, short name and country are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        shortName: form.shortName.trim().toUpperCase(),
        country: form.country,
        logo: form.logo?.url ? { url: form.logo.url, publicId: form.logo.publicId || "" } : {},
        color: form.color,
        coach: form.coach,
        homeGround: form.homeGround,
        players: form.players,
        captain: form.captain || undefined,
        wicketkeeper: form.wicketkeeper || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await api(`/api/teams/${editing._id}`, { method: "PATCH", body });
        success(`${body.shortName} updated everywhere`);
      } else {
        await api("/api/teams", { method: "POST", body });
        success(`${body.shortName} added to the team directory`);
      }
      setFormOpen(false);
      await Promise.allSettled([refetch(true), refetchCountries(true), refetchPlayers(true)]);
    } catch (err) {
      toastError(err.message || "Could not save the team");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    const { action, team } = confirm;
    setBusy(true);
    try {
      if (action === "archive") {
        await api(`/api/teams/${team._id}/archive`, { method: "PATCH", body: { isActive: !team.isActive } });
        success(team.isActive ? `${team.shortName} archived` : `${team.shortName} restored`);
      } else if (action === "delete") {
        await api(`/api/teams/${team._id}`, { method: "DELETE" });
        success(`${team.shortName} deleted`);
      }
      setConfirm(null);
      await refetch(true);
    } catch (err) {
      toastError(err.message || "That action could not be completed");
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy =
    confirm?.action === "delete"
      ? {
          title: "Delete this team?",
          text: "Teams used in matches cannot be deleted. Archive them instead so their history stays intact.",
          label: "Delete team",
        }
      : {
          title: confirm?.action === "archive" ? "Archive this team?" : "Restore this team?",
          text:
            confirm?.action === "archive"
              ? "Archived teams disappear from selection menus but keep every player, match and statistic."
              : "The team will be selectable again for new fixtures.",
          label: confirm?.action === "archive" ? "Archive team" : "Restore team",
        };

  if (loading && !data) return <PageLoader label="Loading the team directory…" />;

  return (
    <AdminPage
      eyebrow="Squad management"
      title="Teams"
      subtitle="Register a badge and squad once. Every fixture, scorecard and lineup reuses the same players."
      actions={
        <button onClick={openCreate} className="btn-primary btn-xs">
          <Plus size={13} /> New team
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Shield} label="Teams" value={formatNumber(counts.total)} hint="across every competition" accent="text-lime" />
        <StatCard icon={Check} label="Active" value={counts.active} hint="available for fixtures" accent="text-mint" />
        <StatCard icon={Users} label="Squad slots" value={formatNumber(counts.players)} hint="player registrations" accent="text-sky" />
        <StatCard icon={Archive} label="Archived" value={counts.archived} hint="history preserved" accent="text-white/60" />
      </div>

      <Panel bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            tabs={[
              { key: "active", label: `Active (${counts.active})` },
              { key: "archived", label: `Archived (${counts.archived})` },
              { key: "all", label: `All (${counts.total})` },
            ]}
            value={tab}
            onChange={setTab}
            size="sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, coach or ground…" className="input !py-2 pl-9 text-xs" />
            </label>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="input !w-auto !py-2 text-xs">
              <option value="all" className="bg-ink-900">All countries</option>
              {countries.map((row) => (
                <option key={row._id} value={row._id} className="bg-ink-900">{row.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((team) => (
              <div key={team._id} className={cn("group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-lime/25", !team.isActive && "opacity-70")}>
                <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: team.color || "#00e28a" }} />
                <div className="flex items-start gap-3">
                  <TeamLogo team={team} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-700 text-white">{team.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40">
                          <CountryFlag country={team.country} /> {team.country?.name || "No country"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">{team.shortName}</span>
                    </div>
                    <p className="mt-2 truncate text-[10px] text-white/35">{team.homeGround || "Home ground TBC"}{team.coach ? ` · ${team.coach}` : ""}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5 text-[10px]">
                  <span className="chip !py-0.5 !text-[9px]"><Users size={9} className="text-lime" /> {team.players?.length || 0} players</span>
                  {team.captain?.name && <span className="chip !py-0.5 !text-[9px]"><Crown size={9} className="text-lime" /> {team.captain.name}</span>}
                  {team.wicketkeeper?.name && <span className="chip !py-0.5 !text-[9px]"><Shirt size={9} className="text-sky" /> {team.wicketkeeper.name}</span>}
                  {!team.isActive && <span className="chip !border-amber-400/20 !bg-amber-400/10 !py-0.5 !text-[9px] !text-amber-200">Archived</span>}
                </div>

                <div className="mt-2.5 flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(team)} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:border-sky/30 hover:text-sky" title="Edit team">
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => setConfirm({ action: "archive", team })}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:border-amber-400/30 hover:text-amber-200"
                    title={team.isActive ? "Archive team" : "Restore team"}
                  >
                    {team.isActive ? <Archive size={12} /> : <ArchiveRestore size={12} />}
                  </button>
                  <button onClick={() => setConfirm({ action: "delete", team })} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/40 transition hover:border-coral/30 hover:text-coral" title="Delete team">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Shield size={20} />}
              title="No teams match this view"
              text="Create a team, or clear the search and country filters."
              action={<button onClick={openCreate} className="btn-primary btn-xs"><Plus size={12} /> New team</button>}
            />
          </div>
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={() => (busy ? null : setFormOpen(false))}
        title={editing ? `Edit ${editing.shortName}` : "Register a new team"}
        subtitle="The badge, colours and squad appear everywhere automatically."
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-white/30">{form.players.length} players selected{form.captain ? " · captain set" : ""}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost" disabled={busy}>Cancel</button>
              <button type="submit" form="team-form" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save team" : "Create team"}</button>
            </div>
          </div>
        }
      >
        <form id="team-form" onSubmit={save} className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Team name" required>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Nepal" required />
              </Field>
              <Field label="Short name" required hint="Up to 6 characters, shown on scorecards">
                <input value={form.shortName} onChange={(event) => setForm({ ...form, shortName: event.target.value.toUpperCase() })} className="input uppercase" maxLength={6} placeholder="NEP" required />
              </Field>
            </div>

            <Field label="Country" required hint="Country flags and colours are reused from the country directory">
              <select
                value={form.country}
                onChange={(event) => {
                  const nextCountry = countries.find((row) => row._id === event.target.value);
                  setForm({ ...form, country: event.target.value, color: nextCountry?.color || form.color });
                }}
                className="input"
                required
              >
                <option value="" className="bg-ink-900">Choose a country</option>
                {countries.map((row) => (
                  <option key={row._id} value={row._id} className="bg-ink-900">{row.name} ({row.code})</option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coach">
                <input value={form.coach} onChange={(event) => setForm({ ...form, coach: event.target.value })} className="input" placeholder="Head coach" />
              </Field>
              <Field label="Home ground">
                <input value={form.homeGround} onChange={(event) => setForm({ ...form, homeGround: event.target.value })} className="input" placeholder="Ground name" />
              </Field>
            </div>

            <UploadField
              label="Team logo / badge"
              value={form.logo}
              onChange={(logo) => setForm({ ...form, logo: logo || { url: "", publicId: "" } })}
              folder="teams"
              hint="Leave empty to use the country flag. Upload once and it shows everywhere."
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Team colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-ink-950 p-1" />
                  <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="input font-mono text-xs" placeholder="#00e28a" />
                </div>
              </Field>
              <div className="flex items-end sm:pb-0.5">
                <Toggle checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Active" hint="Selectable for fixtures" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white">Squad</p>
                <p className="text-[10px] text-white/35">Pick registered players — never retype their details.</p>
              </div>
              <span className="chip !py-1 !text-[10px]"><Users size={10} className="text-lime" /> {form.players.length}</span>
            </div>

            <label className="relative block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search registered players…" className="input !py-2 pl-9 text-xs" />
            </label>

            <div className="max-h-[330px] space-y-1 overflow-y-auto pr-1">
              {squad.length ? (
                squad.map((player) => {
                  const active = form.players.map(String).includes(String(player._id));
                  const home = form.country && idOf(player.country) === form.country;
                  return (
                    <button
                      key={player._id}
                      type="button"
                      onClick={() => togglePlayer(player)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                        active ? "border-lime/30 bg-lime/[0.07]" : "border-white/[0.05] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.04]"
                      )}
                    >
                      <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", active ? "border-lime bg-lime text-ink-950" : "border-white/20 text-transparent")}>
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <PlayerAvatar player={player} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-white/80">{player.name}</span>
                        <span className="block truncate text-[9px] text-white/30">{player.role} · {player.country?.name || "—"}{home ? " · home" : ""}</span>
                      </span>
                      {player.isCaptain && <Crown size={10} className="shrink-0 text-lime" />}
                      {player.isWicketkeeper && <Shirt size={10} className="shrink-0 text-sky" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-6 text-center">
                  <UserRound size={18} className="mx-auto mb-2 text-white/20" />
                  <p className="text-[11px] text-white/35">No registered players found.</p>
                  <p className="mt-0.5 text-[9px] text-white/25">Add players in the Players page first, then reuse them here.</p>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Captain">
                <select value={form.captain} onChange={(event) => setForm({ ...form, captain: event.target.value })} className="input !py-2 text-xs">
                  <option value="" className="bg-ink-900">No captain</option>
                  {selectedPlayers.map((player) => (
                    <option key={player._id} value={player._id} className="bg-ink-900">{player.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Wicket-keeper">
                <select value={form.wicketkeeper} onChange={(event) => setForm({ ...form, wicketkeeper: event.target.value })} className="input !py-2 text-xs">
                  <option value="" className="bg-ink-900">No keeper</option>
                  {selectedPlayers.map((player) => (
                    <option key={player._id} value={player._id} className="bg-ink-900">{player.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={runAction}
        title={confirmCopy.title}
        text={confirmCopy.text}
        confirmLabel={confirmCopy.label}
        danger={confirm?.action !== "archive" || confirm?.team?.isActive}
        loading={busy}
      />
    </AdminPage>
  );
}
