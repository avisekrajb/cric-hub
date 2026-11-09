import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, Sparkles, Tv, Zap } from "lucide-react";
import Logo from "../components/common/Logo";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export default function AdminLogin() {
  const { user, isAdmin, login, loading } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@bethub.com");
  const [password, setPassword] = useState("Bethub@123");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Admin sign in · Bethub";
    return () => {
      document.title = "Bethub · Live cricket, realtime";
    };
  }, []);

  if (!loading && user && isAdmin) return <Navigate to="/admin" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const logged = await login(email.trim(), password);
      success(`Welcome back, ${logged.name || "scorer"}`);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Could not sign in");
      toastError(err.message || "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-950 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-lime/10 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-mint[0.08] bg-mint/10 blur-3xl" />
        <div className="relative">
          <Logo />
          <div className="mt-20 max-w-lg">
            <p className="eyebrow flex items-center gap-2"><Sparkles size={13} /> The scorer's room</p>
            <h1 className="mt-3 font-display text-4xl font-700 leading-[1.05] tracking-tight text-white">
              Score it once.<br /><span className="gradient-text">Broadcast it everywhere.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/45">
              Ball-by-ball scoring, automatic strike rotation, live video, replays and realtime stats — all from one console.
            </p>
            <div className="mt-8 grid gap-2.5">
              {[
                { icon: Zap, title: "Ball-by-ball console", text: "Runs, extras, wickets, undo and auto bowler rotation." },
                { icon: Tv, title: "Go live in seconds", text: "Camera, HLS or embed — with recording and instant replay." },
                { icon: ShieldCheck, title: "One source of truth", text: "Every player, team, score and video stored in one place." },
              ].map((row) => (
                <div key={row.title} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime"><row.icon size={15} /></span>
                  <div>
                    <p className="text-xs font-semibold text-white/80">{row.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/35">{row.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="relative text-[10px] text-white/25">Bethub v1.0 · realtime cricket, end to end.</p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-lime"><LockKeyhole size={12} /> Admin access</p>
          <h1 className="mt-2 font-display text-2xl font-700 text-white">Welcome back to the control room</h1>
          <p className="mt-1 text-sm text-white/45">Sign in with your scorer account to run matches.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="input" placeholder="admin@bethub.com" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <span className="relative block">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
            </label>

            {error && <p className="rounded-lg border border-coral/20 bg-coral/10 px-3 py-2 text-[11px] text-coral">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={busy || loading}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              {busy ? "Signing in…" : "Open the control room"}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Demo credentials</p>
            <p className="mt-1 font-mono text-[11px] text-white/55">admin@bethub.com</p>
            <p className="font-mono text-[11px] text-white/55">Bethub@123</p>
            <p className="mt-1 text-[9px] text-white/25">Change these in Settings after your first sign-in.</p>
          </div>

          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-lime"><ArrowLeft size={12} /> Back to the public site</Link>
        </div>
      </div>
    </div>
  );
}
