import { useMemo, useState } from "react";
import {
  Check,
  Flag,
  Globe2,
  Pencil,
  Plus,
  Search,
  Shield,
  ToggleLeft,
  Trash2,
  UserRound,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, Toggle } from "./components/AdminUI";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import UploadField from "../components/common/UploadField";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import { cn, formatNumber } from "../lib/utils";

const emptyForm = () => ({
  name: "",
  code: "",
  flag: { url: "", publicId: "" },
  color: "#22c55e",
  isActive: true,
});

export default function AdminCountries() {
  const { data, loading, refetch } = useFetch("/api/countries?active=all", { poll: 60000 });
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const countries = data?.countries || [];

  const counts = useMemo(
    () => ({
      total: countries.length,
      active: countries.filter((row) => row.isActive).length,
      teams: countries.reduce((sum, row) => sum + (row.teamCount || 0), 0),
      players: countries.reduce((sum, row) => sum + (row.playerCount || 0), 0),
    }),
    [countries]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return countries.filter((row) => {
      if (tab === "active" && !row.isActive) return false;
      if (tab === "inactive" && row.isActive) return false;
      if (!term) return true;
      return `${row.name} ${row.code}`.toLowerCase().includes(term);
    });
  }, [countries, search, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (country) => {
    setEditing(country);
    setForm({
      name: country.name || "",
      code: country.code || "",
      flag: country.flag?.url ? { url: country.flag.url, publicId: country.flag.publicId || "" } : { url: "", publicId: "" },
      color: country.color || "#22c55e",
      isActive: country.isActive !== false,
    });
    setFormOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toastError("Country name and code are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        flag: form.flag?.url ? { url: form.flag.url, publicId: form.flag.publicId || "" } : {},
        color: form.color,
        isActive: form.isActive,
      };
      if (editing) {
        await api(`/api/countries/${editing._id}`, { method: "PATCH", body });
        success(`${body.name} updated — the flag changes everywhere`);
      } else {
        await api("/api/countries", { method: "POST", body });
        success(`${body.name} added to the directory`);
      }
      setFormOpen(false);
      await refetch(true);
    } catch (err) {
      toastError(err.message || "Could not save the country");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (country) => {
    try {
      await api(`/api/countries/${country._id}`, { method: "PATCH", body: { isActive: !country.isActive } });
      success(country.isActive ? `${country.name} hidden from selectors` : `${country.name} is active again`);
      await refetch(true);
    } catch (err) {
      toastError(err.message || "Could not update the country");
    }
  };

  const runDelete = async () => {
    if (!confirm?.country) return;
    setBusy(true);
    try {
      await api(`/api/countries/${confirm.country._id}`, { method: "DELETE" });
      success(`${confirm.country.name} removed`);
      setConfirm(null);
      await refetch(true);
    } catch (err) {
      toastError(err.message || "Could not delete this country");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <PageLoader label="Loading the country directory…" />;

  return (
    <AdminPage
      eyebrow="Global directory"
      title="Countries"
      subtitle="Upload a flag once and every team, player and scorecard picks it up automatically."
      actions={
        <button onClick={openCreate} className="btn-primary btn-xs">
          <Plus size={13} /> New country
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={Globe2} label="Countries" value={formatNumber(counts.total)} hint="in the directory" accent="text-lime" />
        <StatCard icon={Check} label="Active" value={counts.active} hint="shown in selectors" accent="text-mint" />
        <StatCard icon={Shield} label="Teams" value={formatNumber(counts.teams)} hint="linked across countries" accent="text-sky" />
        <StatCard icon={UserRound} label="Players" value={formatNumber(counts.players)} hint="using these flags" accent="text-white/60" />
      </div>

      <Panel bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
            {[
              { key: "all", label: `All (${counts.total})` },
              { key: "active", label: `Active (${counts.active})` },
              { key: "inactive", label: `Hidden (${counts.total - counts.active})` },
            ].map((row) => (
              <button
                key={row.key}
                onClick={() => setTab(row.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                  tab === row.key ? "bg-lime text-ink-950" : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                {row.label}
              </button>
            ))}
          </div>
          <label className="relative sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Country name or code…" className="input !py-2 pl-9 text-xs" />
          </label>
        </div>

        {filtered.length ? (
          <div className="grid gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((country) => (
              <div
                key={country._id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-lime/25",
                  !country.isActive && "opacity-60"
                )}
              >
                <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: country.color || "#22c55e" }} />
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {country.flag?.url ? (
                      <img src={country.flag.url} alt={`${country.name} flag`} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Flag size={17} className="text-white/25" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white/85">{country.name}</p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/35">{country.code}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleActive(country)}
                      className={cn(
                        "rounded-lg border p-1.5 transition",
                        country.isActive
                          ? "border-mint/25 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/[0.03] text-white/35 hover:text-white"
                      )}
                      title={country.isActive ? "Hide from selectors" : "Show in selectors"}
                    >
                      <ToggleLeft size={12} />
                    </button>
                    <button onClick={() => openEdit(country)} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:border-sky/30 hover:text-sky" title="Edit country">
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setConfirm({ country })}
                      disabled={(country.teamCount || 0) + (country.playerCount || 0) > 0}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/40 transition hover:border-coral/30 hover:text-coral disabled:cursor-not-allowed disabled:opacity-25"
                      title={(country.teamCount || 0) + (country.playerCount || 0) > 0 ? "Reassign teams and players first" : "Delete country"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.06] pt-2 text-[10px] text-white/35">
                  <span>{country.teamCount || 0} teams</span>
                  <span className="text-white/15">·</span>
                  <span>{country.playerCount || 0} players</span>
                  {!country.isActive && <span className="ml-auto text-amber-200/70">Hidden</span>}
                  {country.isActive && <span className="ml-auto inline-flex items-center gap-1 text-mint"><span className="h-1 w-1 rounded-full bg-mint" /> Active</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={<Flag size={20} />}
              title="No countries in this view"
              text="Add a country and upload its flag once."
              action={<button onClick={openCreate} className="btn-primary btn-xs"><Plus size={12} /> New country</button>}
            />
          </div>
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={() => (busy ? null : setFormOpen(false))}
        title={editing ? `Edit ${editing.name}` : "Add a country"}
        subtitle="The flag is reused by every team and player from this country."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button type="submit" form="country-form" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save country" : "Add country"}</button>
          </div>
        }
      >
        <form id="country-form" onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
            <Field label="Country name" required>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Nepal" required />
            </Field>
            <Field label="Code" required hint="2–4 letters">
              <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="input font-mono uppercase" maxLength={4} placeholder="NEP" required />
            </Field>
          </div>

          <UploadField
            label="Country flag"
            value={form.flag}
            onChange={(flag) => setForm({ ...form, flag: flag || { url: "", publicId: "" } })}
            folder="countries"
            hint="Upload once — it appears on team badges, player cards and scorecards."
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-ink-950 p-1" />
                <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="input font-mono text-xs" placeholder="#22c55e" />
              </div>
            </Field>
            <div className="flex items-end sm:pb-0.5">
              <Toggle checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label="Active" hint="Visible in selectors" />
            </div>
          </div>

          {editing && (editing.teamCount || editing.playerCount) ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-white/40">
              Linked to <b className="text-white/60">{editing.teamCount || 0} teams</b> and <b className="text-white/60">{editing.playerCount || 0} players</b>. The updated flag appears everywhere instantly.
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={runDelete}
        title="Delete this country?"
        text="Only countries with no linked teams or players can be deleted. This cannot be undone."
        confirmLabel="Delete country"
        danger
        loading={busy}
      />
    </AdminPage>
  );
}
