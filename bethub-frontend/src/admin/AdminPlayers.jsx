import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, Toggle } from "./components/AdminUI";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import UploadField from "../components/common/UploadField";
import Tabs from "../components/common/Tabs";
import { CountryFlag, PlayerAvatar } from "../components/common/Avatars";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import { cn, formatNumber } from "../lib/utils";

const ROLES = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
const BATTING_STYLES = ["Right-hand bat", "Left-hand bat"];
const BOWLING_STYLES = [
  "None",
  "Right-arm fast",
  "Right-arm fast-medium",
  "Right-arm medium",
  "Right-arm offbreak",
  "Right-arm legbreak",
  "Left-arm fast",
  "Left-arm medium",
  "Left-arm orthodox",
  "Left-arm wrist-spin",
];

const emptyForm = () => ({
  name: "",
  country: "",
  role: "Batter",
  battingStyle: "Right-hand bat",
  bowlingStyle: "None",
  jerseyNumber: "",
  dateOfBirth: "",
  birthplace: "",
  height: "",
  bio: "",
  photo: { url: "", publicId: "" },
  isCaptain: false,
  isWicketkeeper: false,
  isActive: true,
});

const idOf = (row) => String(row?._id || row || "");
const dateValue = (date) => {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

export default function AdminPlayers() {
  const { data, loading, refetch } = useFetch("/api/players?limit=200&active=all", { poll: 60000 });
  const { data: countryData } = useFetch("/api/countries?active=all");
  const { data: teamData, refetch: refetchTeams } = useFetch("/api/teams?active=all");
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [country, setCountry] = useState("all");
  const [tab, setTab] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const players = data?.players || [];
  const countries = countryData?.countries || [];
  const teams = teamData?.teams || [];

  const teamMap = useMemo(() => {
    const map = new Map();
    for (const team of teams) {
      for (const player of team.players || []) {
        const id = idOf(player);
        map.set(id, [...(map.get(id) || []), team]);
      }
    }
    return map;
  }, [teams]);

  const counts = useMemo(
    () => ({
      total: players.length,
      active: players.filter((player) => player.isActive).length,
      archived: players.filter((player) => !player.isActive).length,
      keepers: players.filter((player) => player.isWicketkeeper).length,
    }),
    [players]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) => {
      if (tab === "active" && !player.isActive) return false;
      if (tab === "archived" && player.isActive) return false;
      if (role !== "all" && player.role !== role) return false;
      if (country !== "all" && idOf(player.country) !== country) return false;
      if (!term) return true;
      return `${player.name} ${player.birthplace} ${player.country?.name} ${player.role} ${player.battingStyle}`.toLowerCase().includes(term);
    });
  }, [players, search, role, country, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), country: countries[0]?._id || "" });
    setFormOpen(true);
  };

  const openEdit = (player) => {
    setEditing(player);
    setForm({
      name: player.name || "",
      country: idOf(player.country),
      role: player.role || "Batter",
      battingStyle: player.battingStyle || "Right-hand bat",
      bowlingStyle: player.bowlingStyle || "None",
      jerseyNumber: player.jerseyNumber ?? "",
      dateOfBirth: dateValue(player.dateOfBirth),
      birthplace: player.birthplace || "",
      height: player.height || "",
      bio: player.bio || "",
      photo: player.photo?.url ? { url: player.photo.url, publicId: player.photo.publicId || "" } : { url: "", publicId: "" },
      isCaptain: Boolean(player.isCaptain),
      isWicketkeeper: Boolean(player.isWicketkeeper),
      isActive: player.isActive !== false,
    });
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.country) {
      toastError("Player name and country are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        country: form.country,
        role: form.role,
        battingStyle: form.battingStyle,
        bowlingStyle: form.bowlingStyle,
        jerseyNumber: form.jerseyNumber === "" ? undefined : Number(form.jerseyNumber),
        dateOfBirth: form.dateOfBirth || undefined,
        birthplace: form.birthplace,
        height: form.height,
        bio: form.bio,
        photo: form.photo?.url ? { url: form.photo.url, publicId: form.photo.publicId || "" } : {},
        isCaptain: form.isCaptain,
        isWicketkeeper: form.isWicketkeeper,
        isActive: form.isActive,
      };
      if (editing) {
        await api(`/api/players/${editing._id}`, { method: "PATCH", body });
        success(`${body.name} updated`);
      } else {
        await api("/api/players", { method: "POST", body });
        success(`${body.name} registered — reuse them in any team`);
      }
      setFormOpen(false);
      await Promise.allSettled([refetch(true), refetchTeams(true)]);
    } catch (err) {
      toastError(err.message || "Could not save the player");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    const { action, player } = confirm;
    setBusy(true);
    try {
      if (action === "archive") {
        await api(`/api/players/${player._id}`, { method: "DELETE" });
        success(`${player.name} archived — career history is safe`);
      } else if (action === "restore") {
        await api(`/api/players/${player._id}/restore`, { method: "POST", body: {} });
        success(`${player.name} restored`);
      } else if (action === "delete") {
        await api(`/api/players/${player._id}?hard=true`, { method: "DELETE" });
        success(`${player.name} permanently deleted`);
      }
      setConfirm(null);
      await Promise.allSettled([refetch(true), refetchTeams(true)]);
    } catch (err) {
      toastError(err.message || "That action could not be completed");
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = {
    archive: {
      title: "Archive this player?",
      text: "They disappear from team pickers but every run, wicket and match keeps their name attached.",
      label: "Archive player",
      danger: false,
    },
    restore: {
      title: "Restore this player?",
      text: "They become available in team and lineup selectors again.",
      label: "Restore player",
      danger: false,
    },
    delete: {
      title: "Permanently delete this player?",
      text: "This removes them from every squad and cannot be undone. Archive is safer if they have played a match.",
      label: "Delete forever",
      danger: true,
    },
  }[confirm?.action] || {};

  if (loading && !data) return <PageLoader label="Loading the player register…" />;

  return (
    <AdminPage
      eyebrow="Player register"
      title="Players"
      subtitle="Add a player once with their photo and career details. Every team, lineup and scorecard reuses the same record."
      actions={
        <button onClick={openCreate} className="btn-primary btn-xs">
          <Plus size={13} /> New player
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={UserRound} label="Players" value={formatNumber(counts.total)} hint="registered once" accent="text-lime" />
        <StatCard icon={Check} label="Active" value={counts.active} hint="available for squads" accent="text-mint" />
        <StatCard icon={Shield} label="Teams used" value={formatNumber(teams.length)} hint="squads built from this list" accent="text-sky" />
        <StatCard icon={Archive} label="Archived" value={counts.archived} hint={`${counts.keepers} wicket-keepers`} accent="text-white/60" />
      </div>

      <Panel bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
              <label className="relative flex-1 sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, birthplace…" className="input !py-2 pl-9 text-xs" />
              </label>
              <select value={role} onChange={(event) => setRole(event.target.value)} className="input !w-auto !py-2 text-xs">
                <option value="all" className="bg-ink-900">All roles</option>
                {ROLES.map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
              </select>
              <select value={country} onChange={(event) => setCountry(event.target.value)} className="input !w-auto !py-2 text-xs">
                <option value="all" className="bg-ink-900">All countries</option>
                {countries.map((row) => <option key={row._id} value={row._id} className="bg-ink-900">{row.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Teams</th>
                  <th>Profile</th>
                  <th className="!text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => {
                  const memberships = teamMap.get(String(player._id)) || [];
                  return (
                    <tr key={player._id} className={cn(!player.isActive && "opacity-60")}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar player={player} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-white/85">
                              {player.name}
                              {player.isCaptain && <span className="rounded bg-lime/15 px-1 text-[8px] font-bold text-lime">C</span>}
                              {player.isWicketkeeper && <span className="rounded bg-sky/15 px-1 text-[8px] font-bold text-sky">WK</span>}
                            </p>
                            <p className="truncate text-[10px] text-white/30">
                              {player.jerseyNumber ? `#${player.jerseyNumber} · ` : ""}{player.birthplace || "Birthplace not set"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-[11px] text-white/65">{player.role}</p>
                        <p className="max-w-[150px] truncate text-[9px] text-white/30">{player.battingStyle}{player.bowlingStyle && player.bowlingStyle !== "None" ? ` · ${player.bowlingStyle}` : ""}</p>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                          <CountryFlag country={player.country} /> {player.country?.name || "—"}
                        </span>
                      </td>
                      <td>
                        {memberships.length ? (
                          <div className="flex flex-wrap gap-1">
                            {memberships.slice(0, 2).map((team) => (
                              <span key={team._id} className="chip !py-0.5 !text-[9px]">{team.shortName}</span>
                            ))}
                            {memberships.length > 2 && <span className="text-[9px] text-white/30">+{memberships.length - 2}</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/25">Unattached</span>
                        )}
                      </td>
                      <td>
                        <p className="text-[10px] text-white/40">{player.dateOfBirth ? new Date(player.dateOfBirth).getFullYear() : "—"}</p>
                        <p className="text-[9px] text-white/25">{player.height || "Height n/a"}</p>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(player)} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:border-sky/30 hover:text-sky" title="Edit player">
                            <Pencil size={12} />
                          </button>
                          {player.isActive ? (
                            <button onClick={() => setConfirm({ action: "archive", player })} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/45 transition hover:border-amber-400/30 hover:text-amber-200" title="Archive player">
                              <Archive size={12} />
                            </button>
                          ) : (
                            <button onClick={() => setConfirm({ action: "restore", player })} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:border-mint/30 hover:text-mint" title="Restore player">
                              <ArchiveRestore size={12} />
                            </button>
                          )}
                          <button onClick={() => setConfirm({ action: "delete", player })} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/40 transition hover:border-coral/30 hover:text-coral" title="Delete permanently">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<UserRound size={20} />}
              title="No players in this view"
              text="Register a player once, then select them in any team."
              action={<button onClick={openCreate} className="btn-primary btn-xs"><Plus size={12} /> New player</button>}
            />
          </div>
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={() => (busy ? null : setFormOpen(false))}
        title={editing ? `Edit ${editing.name}` : "Register a player"}
        subtitle="One record. Reused in every squad, lineup and scorecard."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button type="submit" form="player-form" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save player" : "Register player"}</button>
          </div>
        }
      >
        <form id="player-form" onSubmit={save} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Player name" required />
                </Field>
                <Field label="Country" required>
                  <select value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="input" required>
                    <option value="" className="bg-ink-900">Choose a country</option>
                    {countries.map((row) => <option key={row._id} value={row._id} className="bg-ink-900">{row.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role">
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="input">
                    {ROLES.map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
                  </select>
                </Field>
                <Field label="Jersey number">
                  <input type="number" min="0" max="999" value={form.jerseyNumber} onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })} className="input" placeholder="18" />
                </Field>
              </div>
            </div>
            <UploadField
              label="Photo"
              value={form.photo}
              onChange={(photo) => setForm({ ...form, photo: photo || { url: "", publicId: "" } })}
              folder="players"
              shape="circle"
              hint="Shown in squads, scorecards and stats."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Batting style">
              <select value={form.battingStyle} onChange={(event) => setForm({ ...form, battingStyle: event.target.value })} className="input">
                {BATTING_STYLES.map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
              </select>
            </Field>
            <Field label="Bowling style">
              <select value={form.bowlingStyle} onChange={(event) => setForm({ ...form, bowlingStyle: event.target.value })} className="input">
                {BOWLING_STYLES.map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date of birth">
              <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="input" />
            </Field>
            <Field label="Birthplace">
              <input value={form.birthplace} onChange={(event) => setForm({ ...form, birthplace: event.target.value })} className="input" placeholder="City, country" />
            </Field>
            <Field label="Height">
              <input value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} className="input" placeholder="1.78 m" />
            </Field>
          </div>

          <Field label="Short bio" hint="Optional — shown on the public player profile">
            <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={3} className="input resize-none" placeholder="A line about their game…" maxLength={800} />
          </Field>

          <div className="grid gap-2 sm:grid-cols-3">
            <Toggle checked={form.isCaptain} onChange={(value) => setForm({ ...form, isCaptain: value })} label="Captain" hint="Leadership badge" />
            <Toggle checked={form.isWicketkeeper} onChange={(value) => setForm({ ...form, isWicketkeeper: value })} label="Wicket-keeper" hint="WK badge" />
            <Toggle checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Active" hint="Available for squads" />
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
        danger={confirmCopy.danger}
        loading={busy}
      />
    </AdminPage>
  );
}
