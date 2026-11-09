import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CloudUpload,
  HardDrive,
  KeyRound,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Save,
  ShieldCheck,
  Timer,
  UserRound,
  Video,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, StatusDot } from "./components/AdminUI";
import UploadField from "../components/common/UploadField";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { api, setToken } from "../lib/api";
import { copyText, formatDate } from "../lib/utils";

const emptyPassword = { currentPassword: "", newPassword: "", confirm: "" };

const LIMIT_META = {
  maxLiveHours: { icon: Timer, tone: "text-coral", step: 0.5, integer: false },
  maxLiveMatches: { icon: Radio, tone: "text-coral", step: 1, integer: true },
  maxRecordings: { icon: Video, tone: "text-mint", step: 1, integer: true },
  maxVideoMb: { icon: CloudUpload, tone: "text-sky", step: 25, integer: true },
  maxImageMb: { icon: HardDrive, tone: "text-lime", step: 5, integer: true },
};

const LIMIT_FALLBACKS = {
  maxLiveHours: { label: "Live video limit", unit: "hours", min: 0.05, max: 24, hint: "Every live broadcast is auto-ended after this many hours." },
  maxLiveMatches: { label: "Concurrent live matches", unit: "matches", min: 1, max: 50, hint: "How many grounds can be on air at once." },
  maxRecordings: { label: "Concurrent recordings", unit: "recordings", min: 1, max: 50, hint: "How many live streams can record at once." },
  maxVideoMb: { label: "Video upload size", unit: "MB", min: 1, max: 2048, hint: "Highlights, shorts, replays and recordings." },
  maxImageMb: { label: "Image upload size", unit: "MB", min: 1, max: 200, hint: "Logos, flags, avatars and thumbnails." },
};

const limitBounds = (bounds, key) => ({ ...LIMIT_FALLBACKS[key], ...(bounds?.[key] || {}) });

const roundLimit = (value, integer) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return integer ? Math.round(numeric) : Math.round(numeric * 100) / 100;
};

const formatExpiry = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = Math.round((date.getTime() - Date.now()) / 3_600_000);
  if (hours <= 0) return "Expired";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} left`;
};

export default function AdminSettings() {
  const { user, refresh } = useAuth();
  const { success, error: toastError, info } = useToast();
  const { data: session, refetch: refetchSession } = useFetch("/api/auth/session");
  const { data: config } = useFetch("/api/streams/config", { poll: 0 });
  const { data: limitsData, refetch: refetchLimits } = useFetch("/api/ops/limits", { poll: 0 });
  const limits = limitsData?.limits || config?.limits || {};
  const bounds = limitsData?.bounds || {};

  const [profile, setProfile] = useState({ name: "", avatar: { url: "", publicId: "" } });
  const [profileBusy, setProfileBusy] = useState(false);
  const [password, setPassword] = useState(emptyPassword);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [limitsBusy, setLimitsBusy] = useState(false);
  const [limitForm, setLimitForm] = useState({
    maxLiveHours: 4,
    maxLiveMatches: 10,
    maxRecordings: 5,
    maxVideoMb: 200,
    maxImageMb: 50,
  });

  useEffect(() => {
    const current = limitsData?.limits;
    if (!current) return;
    setLimitForm({
      maxLiveHours: current.maxLiveHours ?? 4,
      maxLiveMatches: current.maxLiveMatches ?? 10,
      maxRecordings: current.maxRecordings ?? 5,
      maxVideoMb: current.maxVideoMb ?? 200,
      maxImageMb: current.maxImageMb ?? 50,
    });
  }, [limitsData]);

  const limitRows = Object.keys(LIMIT_META).map((key) => ({
    key,
    ...LIMIT_META[key],
    ...limitBounds(bounds, key),
  }));

  useSocketEvent("settings:limits", (payload) => {
    if (!payload?.limits) return;
    setLimitForm({
      maxLiveHours: payload.limits.maxLiveHours ?? 4,
      maxLiveMatches: payload.limits.maxLiveMatches ?? 10,
      maxRecordings: payload.limits.maxRecordings ?? 5,
      maxVideoMb: payload.limits.maxVideoMb ?? 200,
      maxImageMb: payload.limits.maxImageMb ?? 50,
    });
  });

  const bumpLimit = (key, direction) => {
    const row = limitRows.find((item) => item.key === key);
    if (!row) return;
    const min = Number(row.min) || 0;
    const max = Number(row.max) || 9999;
    setLimitForm((current) => {
      const next = Math.min(max, Math.max(min, Number(current[key] || 0) + direction * (Number(row.step) || 1)));
      return { ...current, [key]: roundLimit(next, row.integer !== false) };
    });
  };

  const saveLimits = async (event) => {
    event.preventDefault();
    setLimitsBusy(true);
    try {
      const result = await api("/api/ops/limits", { method: "PATCH", body: limitForm });
      if (result?.limits) {
        setLimitForm({
          maxLiveHours: result.limits.maxLiveHours,
          maxLiveMatches: result.limits.maxLiveMatches,
          maxRecordings: result.limits.maxRecordings,
          maxVideoMb: result.limits.maxVideoMb,
          maxImageMb: result.limits.maxImageMb,
        });
      }
      await refetchLimits(true);
      success("Platform limits updated — live immediately, no restart");
    } catch (err) {
      toastError(err.message || "Could not update the platform limits");
    } finally {
      setLimitsBusy(false);
    }
  };

  const resetLimits = () => {
    const defaults = limitsData?.defaults || {
      maxLiveHours: 4,
      maxLiveMatches: 10,
      maxRecordings: 5,
      maxVideoMb: 200,
      maxImageMb: 50,
    };
    setLimitForm({
      maxLiveHours: defaults.maxLiveHours ?? 4,
      maxLiveMatches: defaults.maxLiveMatches ?? 10,
      maxRecordings: defaults.maxRecordings ?? 5,
      maxVideoMb: defaults.maxVideoMb ?? 200,
      maxImageMb: defaults.maxImageMb ?? 50,
    });
    info("Defaults loaded — save to apply them");
  };

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name || "", avatar: user.avatar || { url: "", publicId: "" } });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) return toastError("Your name cannot be empty");
    setProfileBusy(true);
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        body: { name: profile.name.trim(), avatar: profile.avatar },
      });
      await refresh();
      refetchSession(true);
      success("Profile updated");
    } catch (err) {
      toastError(err.message || "Could not update your profile");
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    if (password.newPassword.length < 6) {
      setPasswordError("Use at least 6 characters for the new password");
      return;
    }
    if (password.newPassword !== password.confirm) {
      setPasswordError("The new passwords do not match");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await api("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: password.currentPassword, newPassword: password.newPassword },
      });
      if (result?.token) setToken(result.token);
      await refresh();
      setPassword(emptyPassword);
      refetchSession(true);
      success("Password changed — your new session is active");
    } catch (err) {
      setPasswordError(err.message || "Could not change your password");
      toastError(err.message || "Could not change your password");
    } finally {
      setPasswordBusy(false);
    }
  };

  const copyAccountId = async () => {
    const ok = await copyText(String(user?._id || ""));
    if (ok) info("Account ID copied");
    else toastError("Your browser blocked clipboard access");
  };

  return (
    <AdminPage
      eyebrow="Account"
      title="Settings"
      subtitle="Your scoring identity, password and the live platform limits that keep Bethub fast."
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          icon={Radio}
          label="Live match slots"
          value={limits.maxLiveMatches ?? 10}
          hint={`${limits.maxLiveHours ?? 4}h live windows`}
          accent="text-coral"
        />
        <StatCard
          icon={Video}
          label="Recorders"
          value={limits.maxRecordings ?? 5}
          hint="concurrent replays"
          accent="text-mint"
        />
        <StatCard
          icon={CloudUpload}
          label="Video limit"
          value={`${limits.maxVideoMb ?? 200} MB`}
          hint="per upload / replay"
          accent="text-sky"
        />
        <StatCard
          icon={HardDrive}
          label="Image limit"
          value={`${limits.maxImageMb ?? 50} MB`}
          hint="logos, photos, flags"
          accent="text-lime"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Your profile" subtitle="Shown on the admin bar and in the scorer's room">
            <form onSubmit={saveProfile} className="space-y-4">
              <UploadField
                label="Avatar"
                shape="circle"
                value={profile.avatar}
                onChange={(avatar) => setProfile((current) => ({ ...current, avatar }))}
                folder="bethub/avatars"
                hint={`A square photo works best · max ${limits.maxImageMb ?? 50} MB · stored on Cloudinary`}
              />
              <Field label="Display name" required>
                <input
                  className="input"
                  value={profile.name}
                  onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Bethub Admin"
                  maxLength={80}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <input className="input" value={user?.email || ""} disabled readOnly />
                </Field>
                <Field label="Role">
                  <input className="input" value={user?.role || "admin"} disabled readOnly />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <p className="text-[10px] text-white/30">Changes apply instantly across every admin device.</p>
                <button type="submit" className="btn-primary btn-xs" disabled={profileBusy}>
                  {profileBusy ? <Loader2 size={12} className="animate-spin" /> : <UserRound size={12} />}
                  Save profile
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Change password" subtitle="Protect the control room with a fresh password">
            <form onSubmit={changePassword} className="space-y-3">
              <Field label="Current password" required>
                <div className="relative">
                  <LockKeyhole size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    className="input pl-9"
                    value={password.currentPassword}
                    onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="New password" required hint="At least 6 characters">
                  <div className="relative">
                    <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="input pl-9"
                      value={password.newPassword}
                      onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
                      placeholder="New password"
                      required
                    />
                  </div>
                </Field>
                <Field label="Confirm password" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    value={password.confirm}
                    onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))}
                    placeholder="Repeat it"
                    required
                  />
                </Field>
              </div>
              {passwordError && (
                <p className="rounded-lg border border-coral/20 bg-coral/[0.06] px-3 py-2 text-[11px] text-coral">{passwordError}</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <p className="text-[10px] text-white/30">You stay signed in with a refreshed token.</p>
                <button type="submit" className="btn-primary btn-xs" disabled={passwordBusy}>
                  {passwordBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Update password
                </button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Session" subtitle="Your current admin login">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                {user?.avatar?.url ? (
                  <img src={user.avatar.url} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-lime text-sm font-bold text-ink-950">
                    {(user?.name || "A").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/85">{user?.name || "Bethub Admin"}</p>
                  <p className="truncate text-[10px] text-white/35">{user?.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mint">
                  <CheckCircle2 size={10} /> Active
                </span>
              </div>

              <dl className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/35">Token expires</dt>
                  <dd className="text-right font-semibold text-white/70">{formatExpiry(session?.expiresAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/35">Last sign in</dt>
                  <dd className="text-right font-semibold text-white/70">{formatDate(user?.lastLoginAt) || "Just now"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/35">Member since</dt>
                  <dd className="text-right font-semibold text-white/70">{formatDate(user?.createdAt) || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-white/35">Account ID</dt>
                  <dd>
                    <button type="button" onClick={copyAccountId} className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-white/55 transition hover:text-lime">
                      {String(user?._id || "").slice(-8) || "—"} · copy
                    </button>
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>

          <Panel
            title="Platform limits"
            subtitle="Saved to the database and applied to every upload and broadcast instantly"
            action={
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={resetLimits} className="btn-ghost btn-xs" disabled={limitsBusy}>
                  <RotateCcw size={11} /> Defaults
                </button>
                <button type="submit" form="platform-limits-form" className="btn-primary btn-xs" disabled={limitsBusy}>
                  {limitsBusy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
              </div>
            }
          >
            <form id="platform-limits-form" onSubmit={saveLimits} className="space-y-3">
              {limitRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                          <Icon size={11} className={row.tone} /> {row.label}
                        </p>
                        <p className="mt-0.5 text-[9px] leading-relaxed text-white/25">{row.hint}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => bumpLimit(row.key, -1)}
                          className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/50 transition hover:border-coral/40 hover:text-coral"
                          aria-label={`Decrease ${row.label}`}
                        >
                          <Minus size={11} />
                        </button>
                        <div className="relative">
                          <input
                            type="number"
                            className="input h-7 w-20 pr-8 text-right font-mono text-[11px]"
                            value={limitForm[row.key] ?? ""}
                            min={row.min}
                            max={row.max}
                            step="any"
                            onChange={(event) => setLimitForm((current) => ({ ...current, [row.key]: event.target.value }))}
                            onBlur={(event) =>
                              setLimitForm((current) => ({ ...current, [row.key]: roundLimit(event.target.value, row.integer !== false) }))
                            }
                            required
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase text-white/25">{row.unit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => bumpLimit(row.key, 1)}
                          className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/50 transition hover:border-lime/40 hover:text-lime"
                          aria-label={`Increase ${row.label}`}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-[9px] leading-relaxed text-white/25">
                Live video stops automatically at the configured window. Upload limits are enforced before a file is saved.
                {limitsData?.updatedAt
                  ? ` Last changed ${formatDate(limitsData.updatedAt)}${limitsData.updatedByName ? ` by ${limitsData.updatedByName}` : ""}.`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3">
                <StatusDot active label="Cloudinary media" />
                <StatusDot active={Boolean(config?.cloudinary?.cloudName)} label="Image CDN" />
                <StatusDot active={Boolean(config?.livekit?.enabled)} label="LiveKit SFU" />
                <StatusDot active={Boolean(config?.turn?.url || config?.turn?.urls?.length)} label="TURN relay" />
              </div>
            </form>
          </Panel>

          <Panel title="Good to know" subtitle="Housekeeping">
            <ul className="space-y-2 text-[11px] leading-relaxed text-white/45">
              <li className="flex gap-2"><CalendarClock size={13} className="mt-0.5 shrink-0 text-lime" /> Sessions last 7 days by default. Changing your password refreshes the token immediately.</li>
              <li className="flex gap-2"><CloudUpload size={13} className="mt-0.5 shrink-0 text-lime" /> Every logo, flag, player photo, short and replay lives on Cloudinary — nothing is stored on the server disk.</li>
              <li className="flex gap-2"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-lime" /> Score, streams and stats are pushed to every viewer over Socket.IO in real time.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
